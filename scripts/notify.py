"""
飞书告警推送模块

分级告警策略：
- 严重 (HIGH): 立即单条推送
- 中等 (MED): 半小时汇总推送
- 轻微 (LOW): 不推送，只在日报中体现
- 采集失败: 立即推送

依赖: Python 3.8+, urllib (stdlib)
"""

import json
import os
import sys
import time
import urllib.request
from datetime import datetime

# 飞书 Webhook URL，从环境变量获取
FEISHU_WEBHOOK = os.environ.get('FEISHU_WEBHOOK', '')

# 汇总推送缓存文件路径
_SUMMARY_CACHE = None


def _get_summary_cache_path(data_dir):
    global _SUMMARY_CACHE
    if _SUMMARY_CACHE is None:
        _SUMMARY_CACHE = os.path.join(data_dir, 'alert_cache.json')
    return _SUMMARY_CACHE


def _load_cache(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'alerts': [], 'last_push': 0}


def _save_cache(path, cache):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False)


def _send_feishu(title, content_lines):
    """发送飞书富文本消息。"""
    if not FEISHU_WEBHOOK:
        print("  [NOTIFY] FEISHU_WEBHOOK 未设置，跳过推送", file=sys.stderr)
        return False

    # 飞书消息卡片格式
    card = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": title},
                "template": "red" if "严重" in title or "失败" in title else "orange" if "中等" in title else "blue",
            },
            "elements": [
                {
                    "tag": "div",
                    "text": {"tag": "lark_md", "content": "\n".join(content_lines)},
                }
            ],
        },
    }

    last_err = None
    for attempt in range(2):  # 最多重试 1 次
        try:
            data = json.dumps(card).encode('utf-8')
            req = urllib.request.Request(
                FEISHU_WEBHOOK,
                data=data,
                headers={'Content-Type': 'application/json'},
            )
            resp = urllib.request.urlopen(req, timeout=10)
            result = json.loads(resp.read().decode('utf-8'))
            if result.get('code') == 0:
                print(f"  [NOTIFY] 飞书推送成功: {title}", file=sys.stderr)
                return True
            else:
                print(f"  [NOTIFY] 飞书推送失败: {result}", file=sys.stderr)
                return False
        except Exception as e:
            last_err = e
            if attempt == 0:
                print(f"  [NOTIFY] 飞书推送异常(重试): {e}", file=sys.stderr)
                import time
                time.sleep(2)
            else:
                print(f"  [NOTIFY] 飞书推送异常: {e}", file=sys.stderr)
    return False


def notify_critical(anomalies):
    """严重异常立即推送。"""
    if not anomalies:
        return
    lines = []
    for a in anomalies[:10]:  # 最多显示 10 条
        sev = a.get('severity', '未知')
        lines.append(f"🔴 **[{sev}]** {a.get('type', '')} | {a.get('shop', '')}")
        lines.append(f"   订单 {a.get('oid', '')} | {a.get('detail', '')}")
        if a.get('rider'):
            lines.append(f"   骑手: {a['rider']}")
        lines.append("")
    if len(anomalies) > 10:
        lines.append(f"...还有 {len(anomalies) - 10} 条")

    title = f"🚨 艾特米严重告警 ({len(anomalies)}条)"
    _send_feishu(title, lines)


def notify_failure(error_msg):
    """采集失败立即推送。"""
    lines = [
        f"⏰ 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"❌ 错误: {error_msg}",
        "",
        "请检查 Session 是否过期或网络是否正常。",
    ]
    _send_feishu("🔴 艾特米采集失败", lines)


def notify_session_expired():
    """Session 过期推送。"""
    lines = [
        f"⏰ 时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Session 已过期，请尽快更新 Cookie。",
        "",
        "更新方法：重新登录艾特米后台，复制新的 PHPSESSID 和 adminsession。",
    ]
    _send_feishu("⚠️ 艾特米 Session 过期", lines)


def add_to_summary_cache(data_dir, anomalies):
    """中等异常加入汇总缓存。"""
    med_anomalies = [a for a in anomalies if a.get('severity') == '中等']
    if not med_anomalies:
        return

    cache_path = _get_summary_cache_path(data_dir)
    cache = _load_cache(cache_path)

    now = time.time()
    for a in med_anomalies:
        cache['alerts'].append({
            'time': now,
            'type': a.get('type', ''),
            'shop': a.get('shop', ''),
            'oid': a.get('oid', ''),
            'detail': a.get('detail', ''),
            'severity': a.get('severity', ''),
        })

    # 保留最近 2 小时
    cutoff = now - 7200
    cache['alerts'] = [a for a in cache['alerts'] if a['time'] > cutoff]
    _save_cache(cache_path, cache)

    # 每 30 分钟汇总推送一次
    if now - cache.get('last_push', 0) >= 1800 and cache['alerts']:
        _flush_summary(data_dir, cache, cache_path)


def _flush_summary(data_dir, cache, cache_path):
    """汇总推送中等异常。"""
    alerts = cache['alerts']
    if not alerts:
        return

    # 按类型统计
    by_type = {}
    for a in alerts:
        t = a['type']
        if t not in by_type:
            by_type[t] = 0
        by_type[t] += 1

    lines = [f"📊 最近 30 分钟共 **{len(alerts)}** 条中等异常：", ""]
    for t, count in by_type.items():
        lines.append(f"  • {t}: {count} 条")
    lines.append("")

    # 最近 5 条详情
    for a in alerts[-5:]:
        lines.append(f"  ⚠️ {a['shop']} | {a['detail']}")
    if len(alerts) > 5:
        lines.append(f"  ...共 {len(alerts)} 条")

    _send_feishu(f"📋 艾特米异常汇总 ({len(alerts)}条)", lines)

    cache['last_push'] = time.time()
    cache['alerts'] = []
    _save_cache(cache_path, cache)


def process_alerts(data_dir, anomalies):
    """处理告警：严重立即推，中等汇总缓存。"""
    # 严重异常立即推
    critical = [a for a in anomalies if a.get('severity') == '严重']
    if critical:
        notify_critical(critical)

    # 中等异常加入汇总缓存
    add_to_summary_cache(data_dir, anomalies)


def send_daily_report(data_dir, summary, competitor, anomalies, ai_report=None):
    """发送每日日报。"""
    now = datetime.now()
    lines = [
        f"📅 {now.strftime('%Y-%m-%d')}",
        "",
        "**📊 今日数据**",
        f"  • 总订单: **{summary.get('total_orders', 0)}**",
        f"  • 配送中: {summary.get('delivering', 0)}",
        f"  • 已完成: {summary.get('completed', 0)}",
        f"  • 售后: {summary.get('aftersale', 0)}",
        "",
        "**⚠️ 异常统计**",
        f"  • 活跃异常: **{summary.get('anomaly_count', 0)}**",
        f"  • 跳扫码: {summary.get('skip_scan_count', 0)}",
    ]

    if competitor and competitor.get('total_stores', 0) > 0:
        lines.extend([
            "",
            "**🏪 竞品**",
            f"  • 今日销量: {competitor.get('total_daily', 0)}",
            f"  • 活跃店铺: {competitor.get('active_stores', 0)}/{competitor.get('total_stores', 0)}",
        ])

    # AI 生成的报告
    if ai_report:
        lines.extend(["", "**🤖 AI 分析**", ai_report])

    _send_feishu(f"📊 艾特米日报 {now.strftime('%m/%d')}", lines)


def flush_pending_summaries(data_dir):
    """强制推送缓存中的中等异常汇总（日报前调用）。"""
    cache_path = _get_summary_cache_path(data_dir)
    cache = _load_cache(cache_path)
    if cache['alerts']:
        _flush_summary(data_dir, cache, cache_path)
