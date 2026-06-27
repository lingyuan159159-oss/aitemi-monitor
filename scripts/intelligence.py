"""
AI 智能分析模块

合并原 ai_report.py（外部 API）与 ai_insight.py（纯规则），共用数据聚合逻辑。
"""

import json
import os
import sys
import urllib.request

AI_API_KEY = os.environ.get('AI_API_KEY', '')
AI_API_BASE = os.environ.get('AI_API_BASE', 'https://api.openai.com/v1')
AI_MODEL = os.environ.get('AI_MODEL', 'gpt-4o-mini')


# --- 通用 AI 调用 ---


def _call_ai(prompt, max_tokens=1000):
    """调用 OpenAI 兼容 API，带一次重试。"""
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

    last_err = None
    for attempt in range(2):
        try:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                url, data=data,
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {AI_API_KEY}'},
            )
            resp = urllib.request.urlopen(req, timeout=30)
            result = json.loads(resp.read().decode('utf-8'))
            if 'error' in result:
                print(f"  [AI] API 返回错误: {result['error'].get('message', result['error'])}", file=sys.stderr)
                return None
            if 'choices' not in result or not result['choices']:
                print(f"  [AI] API 返回无 choices: {list(result.keys())}", file=sys.stderr)
                return None
            content = result['choices'][0]['message']['content'].strip()
            print(f"  [AI] 生成成功 ({len(content)} 字)", file=sys.stderr)
            return content
        except Exception as e:
            last_err = e
            if attempt == 0:
                print(f"  [AI] 调用失败(重试): {e}", file=sys.stderr)
                import time as _t; _t.sleep(2)
            else:
                print(f"  [AI] 调用失败: {e}", file=sys.stderr)
    return None


# --- 纯规则洞察（原 ai_insight.py）---


def generate_insights(current, previous, history):
    """对比当前数据和上次数据，生成洞察列表。

    返回: list of {"type": "warning|info|good", "icon": "emoji", "text": "描述"}
    只返回值得关注的变化，没变化返回空列表。
    """
    insights = []

    # 1. 异常数变化
    curr_anomaly = current.get('summary', {}).get('anomaly_count', 0)
    prev_anomaly = previous.get('summary', {}).get('anomaly_count', 0)
    if curr_anomaly > prev_anomaly and curr_anomaly > 0:
        if curr_anomaly >= prev_anomaly * 2 and prev_anomaly > 0:
            insights.append({"type": "warning", "text": f"异常数翻倍：{prev_anomaly}→{curr_anomaly}，需要关注"})
        elif curr_anomaly - prev_anomaly >= 5:
            insights.append({"type": "warning", "text": f"异常新增 {curr_anomaly - prev_anomaly} 条"})

    # 2. 跳扫码突增
    curr_skip = current.get('summary', {}).get('skip_scan_count', 0)
    prev_skip = previous.get('summary', {}).get('skip_scan_count', 0)
    if curr_skip > prev_skip + 3:
        insights.append({"type": "warning", "text": f"跳扫码增加 {curr_skip - prev_skip} 条"})

    # 3. 高危骑手
    skip_riders = current.get('skip_scan_riders', [])
    for r in skip_riders:
        if r.get('high_risk') and r.get('count', 0) >= 3:
            insights.append({"type": "warning", "text": f"骑手 {r['name']} 已跳扫码 {r['count']} 次，建议排查"})

    # 4. 某区域异常集中
    anomalies = current.get('anomalies', [])
    area_count = {}
    for a in anomalies:
        area = a.get('area', '未知')
        area_count[area] = area_count.get(area, 0) + 1
    for area, count in area_count.items():
        if count >= 5:
            insights.append({"type": "warning", "text": f"{area} 集中 {count} 条异常"})

    # 5. 骑手超时率飙升（合并同一骑手的分拣+配送，最多报3人）
    riders = current.get('riders', [])
    rider_alerts = 0
    for r in riders:
        if rider_alerts >= 3:
            break
        sort_rate = r.get('sort', {}).get('rate', 0)
        deliver_rate = r.get('deliver', {}).get('rate', 0)
        if sort_rate > 50 or deliver_rate > 50:
            parts = []
            if sort_rate > 50:
                parts.append(f"分拣 {sort_rate}%")
            if deliver_rate > 50:
                parts.append(f"配送 {deliver_rate}%")
            insights.append({"type": "warning", "text": f"骑手 {r['name']}({r['area']}) {'、'.join(parts)}，效率下降"})
            rider_alerts += 1

    # 6. 积极变化
    if curr_anomaly < prev_anomaly and prev_anomaly > 0:
        insights.append({"type": "good", "text": f"异常减少 {prev_anomaly - curr_anomaly} 条，形势好转"})

    if not anomalies and prev_anomaly > 0:
        insights.append({"type": "good", "text": "当前零异常，一切正常"})

    # 7. 订单量异常
    curr_orders = current.get('summary', {}).get('total_orders', 0)
    prev_orders = previous.get('summary', {}).get('total_orders', 0)
    if prev_orders > 50 and curr_orders > 0:
        order_chg = abs(curr_orders - prev_orders) / prev_orders
        if order_chg > 0.5:
            direction = '突增' if curr_orders > prev_orders else '骤降'
            insights.append({"type": "warning", "text": f"订单量{direction}：{prev_orders}→{curr_orders}（{order_chg*100:.0f}%），请检查采集是否正常"})

    # 8. 竞品洞察
    curr_comp = current.get('competitor', {})
    prev_comp = previous.get('competitor', {})
    if curr_comp.get('total_stores', 0) > 0 and prev_comp.get('total_stores', 0) > 0:
        curr_daily = curr_comp.get('total_daily', 0)
        prev_daily = prev_comp.get('total_daily', 0)
        if prev_daily > 0 and curr_daily > 0:
            change_pct = (curr_daily - prev_daily) / prev_daily * 100
            if change_pct > 30:
                insights.append({"type": "info", "text": f"竞品总销量涨 {change_pct:.0f}%（{prev_daily}→{curr_daily}）"})
            elif change_pct < -30:
                insights.append({"type": "info", "text": f"竞品总销量跌 {abs(change_pct):.0f}%（{prev_daily}→{curr_daily}）"})

        curr_active = curr_comp.get('active_stores', 0)
        prev_active = prev_comp.get('active_stores', 0)
        if prev_active > 0 and curr_active < prev_active - 3:
            insights.append({"type": "info", "text": f"竞品活跃店铺减少：{prev_active}→{curr_active}家"})

        curr_stores = {s['id']: s for s in curr_comp.get('stores', [])}
        prev_stores = {s['id']: s for s in prev_comp.get('stores', [])}
        for sid, cs in curr_stores.items():
            ps = prev_stores.get(sid)
            if ps and ps.get('hourly', 0) > 5:
                chg = (cs.get('hourly', 0) - ps['hourly']) / ps['hourly'] * 100
                if chg > 100:
                    insights.append({"type": "info", "text": f"竞品 {cs['name']} 小时增量翻倍（{ps['hourly']}→{cs['hourly']}）"})
                elif chg < -60:
                    insights.append({"type": "info", "text": f"竞品 {cs['name']} 小时增量骤降（{ps['hourly']}→{cs['hourly']}）"})

    # 9. 基于历史的趋势分析
    if history and len(history) >= 3:
        recent3 = history[-3:]
        anomaly_trend = [h.get('anomalies', 0) for h in recent3]
        if anomaly_trend[0] > 0 and anomaly_trend[2] > anomaly_trend[0] * 1.5:
            insights.append({"type": "warning", "text": f"异常持续上升：{anomaly_trend[0]}→{anomaly_trend[1]}→{anomaly_trend[2]}"})
        elif anomaly_trend[0] > 0 and anomaly_trend[2] < anomaly_trend[0] * 0.5:
            insights.append({"type": "good", "text": f"异常持续下降：{anomaly_trend[0]}→{anomaly_trend[1]}→{anomaly_trend[2]}"})

    anomaly_insights = [i for i in insights if i['type'] != 'info']
    competitor_insights = [i for i in insights if i['type'] == 'info']
    return anomaly_insights[:3] + competitor_insights[:2]


# --- AI 日报（原 ai_report.py，精简 prompt 模板）---


def generate_daily_report(summary, anomalies, rider_stats, skip_scans, competitor, history):
    """生成每日 AI 分析报告。"""
    # 构建结构化数据
    anomaly_breakdown = {}
    for a in anomalies:
        t = a.get('type', '未知')
        anomaly_breakdown[t] = anomaly_breakdown.get(t, 0) + 1

    top_riders = sorted(
        rider_stats,
        key=lambda r: r['sort']['overtime'] + r['stay']['overtime'] + r['deliver']['overtime'],
        reverse=True,
    )[:5]

    skip_rider_map = {}
    for s in skip_scans:
        name = s.get('rider', '')
        skip_rider_map[name] = skip_rider_map.get(name, 0) + 1
    top_skip = sorted(skip_rider_map.items(), key=lambda x: x[1], reverse=True)[:5]

    # 构建数据块
    data_parts = []
    data_parts.append(
        f"总订单 {summary.get('total_orders', 0)}, "
        f"配送中 {summary.get('delivering', 0)}, "
        f"已完成 {summary.get('completed', 0)}, "
        f"售后 {summary.get('aftersale', 0)}, "
        f"异常 {summary.get('anomaly_count', 0)}, "
        f"跳扫码 {summary.get('skip_scan_count', 0)}"
    )

    if anomaly_breakdown:
        data_parts.append("异常分布: " + ", ".join(f"{t} {c}条" for t, c in anomaly_breakdown.items()))

    if top_riders:
        rider_lines = []
        for r in top_riders:
            total_ot = r['sort']['overtime'] + r['stay']['overtime'] + r['deliver']['overtime']
            rider_lines.append(f"{r['name']}({r['area']}) 超时{total_ot}次 分拣avg{r['sort']['avg']}min 配送avg{r['deliver']['avg']}min")
        data_parts.append("问题骑手: " + "; ".join(rider_lines))

    if top_skip:
        data_parts.append("跳扫码骑手: " + ", ".join(f"{n}({c}次)" for n, c in top_skip))

    if competitor and competitor.get('total_daily', 0) > 0:
        comp_parts = [f"总销量 {competitor['total_daily']}"]
        if competitor.get('total_hourly', 0) > 0:
            comp_parts.append(f"小时增量 {competitor.get('total_hourly', 0)}")
        comp_parts.append(f"活跃 {competitor['active_stores']}/{competitor['total_stores']}家")
        top_stores = sorted(competitor.get('stores', []), key=lambda s: s.get('daily', 0), reverse=True)[:5]
        if top_stores:
            comp_parts.append("TOP: " + ", ".join(f"{s['name']}({s['daily']}单)" for s in top_stores))
        data_parts.append("竞品: " + " | ".join(comp_parts))

    prompt = (
        "分析以下艾特米校园外卖平台今日数据，给出运营建议：\n\n"
        + "\n".join(data_parts)
        + "\n\n请分析：1.今日运营总结（一句话）2.最突出问题及原因 3.竞品分析 4.2-3条改进建议\n"
    )

    return _call_ai(prompt)
