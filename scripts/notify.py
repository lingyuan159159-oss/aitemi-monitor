"""
飞书告警推送模块

分级告警策略：
- 严重 (HIGH): 立即单条推送
- 中等 (MED): 立即推送（简要通知）
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

FEISHU_WEBHOOK = os.environ.get('FEISHU_WEBHOOK', '')


def _send_feishu(title, content_lines):
    """发送飞书富文本消息。"""
    if not FEISHU_WEBHOOK:
        print("  [NOTIFY] FEISHU_WEBHOOK 未设置，跳过推送", file=sys.stderr)
        return False

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
    for attempt in range(2):
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
                time.sleep(2)
            else:
                print(f"  [NOTIFY] 飞书推送异常: {e}", file=sys.stderr)
    return False


def notify_critical(anomalies):
    """严重异常立即推送。"""
    if not anomalies:
        return
    lines = []
    for a in anomalies[:10]:
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


def notify_medium(anomalies):
    """中等异常立即推送（简要通知）。"""
    if not anomalies:
        return
    lines = []
    for a in anomalies[:8]:
        lines.append(f"⚠️ {a.get('shop', '')} | {a.get('type', '')} | {a.get('detail', '')}")
    if len(anomalies) > 8:
        lines.append(f"...还有 {len(anomalies) - 8} 条")
    _send_feishu(f"⚠️ 艾特米中等异常 ({len(anomalies)}条)", lines)


def process_alerts(data_dir, anomalies):
    """处理告警：严重立即推，中等立即推。"""
    critical = [a for a in anomalies if a.get('severity') == '严重']
    if critical:
        notify_critical(critical)

    medium = [a for a in anomalies if a.get('severity') == '中等']
    if medium:
        notify_medium(medium)


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

    if ai_report:
        lines.extend(["", "**🤖 AI 分析**", ai_report])

    _send_feishu(f"📊 艾特米日报 {now.strftime('%m/%d')}", lines)


def flush_pending_summaries(data_dir):
    """保留接口（向后兼容）。中等异常已在 process_alerts 中立即推送，无需汇总。"""
    pass
