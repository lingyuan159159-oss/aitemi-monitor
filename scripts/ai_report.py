"""
AI 日报生成模块

接入 OpenAI 兼容 API，自动生成：
- 每日订单趋势分析
- 异常总结与改进建议
- 骑手运营建议

依赖: Python 3.8+, urllib (stdlib)
"""

import json
import os
import sys
import urllib.request

# AI API 配置，从环境变量获取
AI_API_KEY = os.environ.get('AI_API_KEY', '')
AI_API_BASE = os.environ.get('AI_API_BASE', 'https://api.openai.com/v1')
AI_MODEL = os.environ.get('AI_MODEL', 'gpt-4o-mini')


def _call_ai(prompt, max_tokens=1000):
    """调用 OpenAI 兼容 API。"""
    if not AI_API_KEY:
        print("  [AI] AI_API_KEY 未设置，跳过", file=sys.stderr)
        return None

    url = f"{AI_API_BASE}/chat/completions"
    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": "你是艾特米校园外卖平台的数据分析师。用简洁的中文回答，给出具体可操作的建议。回答控制在 300 字以内。"},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }

    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {AI_API_KEY}',
            },
        )
        resp = urllib.request.urlopen(req, timeout=30)
        result = json.loads(resp.read().decode('utf-8'))
        content = result['choices'][0]['message']['content'].strip()
        print(f"  [AI] 生成成功 ({len(content)} 字)", file=sys.stderr)
        return content
    except Exception as e:
        print(f"  [AI] 调用失败: {e}", file=sys.stderr)
        return None


def generate_daily_report(summary, anomalies, rider_stats, skip_scans, competitor, history):
    """生成每日 AI 分析报告。"""
    # 构建数据摘要给 AI
    anomaly_details = {}
    for a in anomalies:
        t = a.get('type', '未知')
        if t not in anomaly_details:
            anomaly_details[t] = {'count': 0, 'shops': set(), 'severities': {}}
        anomaly_details[t]['count'] += 1
        anomaly_details[t]['shops'].add(a.get('shop', ''))
        sev = a.get('severity', '未知')
        anomaly_details[t]['severities'][sev] = anomaly_details[t]['severities'].get(sev, 0) + 1

    # Top 问题骑手
    top_riders = sorted(rider_stats, key=lambda r: r['sort']['overtime'] + r['stay']['overtime'] + r['deliver']['overtime'], reverse=True)[:5]

    # Top 跳扫码骑手
    skip_rider_map = {}
    for s in skip_scans:
        name = s.get('rider', '')
        if name not in skip_rider_map:
            skip_rider_map[name] = 0
        skip_rider_map[name] += 1
    top_skip = sorted(skip_rider_map.items(), key=lambda x: x[1], reverse=True)[:5]

    prompt = f"""分析以下艾特米校园外卖平台今日数据，给出运营建议：

【今日总览】
- 总订单: {summary.get('total_orders', 0)}
- 配送中: {summary.get('delivering', 0)}
- 已完成: {summary.get('completed', 0)}
- 售后: {summary.get('aftersale', 0)}
- 异常: {summary.get('anomaly_count', 0)}
- 跳扫码: {summary.get('skip_scan_count', 0)}

【异常分布】
"""
    for t, info in anomaly_details.items():
        shops = ', '.join(list(info['shops'])[:3])
        sev_str = ', '.join(f"{k}:{v}" for k, v in info['severities'].items())
        prompt += f"- {t}: {info['count']}条 ({sev_str}) 问题店铺: {shops}\n"

    prompt += "\n【问题骑手 TOP5】\n"
    for r in top_riders:
        total_ot = r['sort']['overtime'] + r['stay']['overtime'] + r['deliver']['overtime']
        prompt += f"- {r['name']}({r['area']}): 超时{total_ot}次, 分拣avg{r['sort']['avg']}min, 配送avg{r['deliver']['avg']}min\n"

    if top_skip:
        prompt += "\n【跳扫码骑手 TOP5】\n"
        for name, count in top_skip:
            prompt += f"- {name}: {count}次\n"

    if competitor and competitor.get('total_daily', 0) > 0:
        prompt += f"\n【竞品（一技生活圈）】\n"
        prompt += f"- 今日总销量: {competitor['total_daily']}，小时增量: {competitor.get('total_hourly', 0)}\n"
        prompt += f"- 活跃店铺: {competitor['active_stores']}/{competitor['total_stores']}家\n"
        # Top 5 店铺
        stores = sorted(competitor.get('stores', []), key=lambda s: s.get('daily', 0), reverse=True)[:5]
        if stores:
            prompt += "- TOP5店铺: "
            prompt += ", ".join(f"{s['name']}({s['daily']}单)" for s in stores)
            prompt += "\n"
        # 零单店铺
        zero_stores = [s for s in competitor.get('stores', []) if s.get('daily', 0) == 0]
        if zero_stores:
            prompt += f"- 零单店铺: {len(zero_stores)}家\n"

    prompt += """
请分析：
1. 今日运营状况总结（一句话）
2. 最突出的问题和原因
3. 竞品分析：哪些店铺在涨/跌，我们的竞争优势在哪
4. 2-3条具体可操作的改进建议
"""

    return _call_ai(prompt)
