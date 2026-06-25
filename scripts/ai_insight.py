"""
AI 实时洞察模块

每次采集后检测数据变化，生成值得关注的洞察。
纯规则引擎，不调外部 API，保证速度。
"""


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

    # 5. 骑手超时率飙升
    riders = current.get('riders', [])
    for r in riders:
        sort_rate = r.get('sort', {}).get('rate', 0)
        deliver_rate = r.get('deliver', {}).get('rate', 0)
        if sort_rate > 50:
            insights.append({"type": "warning", "text": f"骑手 {r['name']}({r['area']}) 分拣超时率 {sort_rate}%，效率下降"})
        if deliver_rate > 50:
            insights.append({"type": "warning", "text": f"骑手 {r['name']}({r['area']}) 配送超时率 {deliver_rate}%"})

    # 6. 积极变化
    if curr_anomaly < prev_anomaly and prev_anomaly > 0:
        insights.append({"type": "good", "text": f"异常减少 {prev_anomaly - curr_anomaly} 条，形势好转"})

    if not anomalies and prev_anomaly > 0:
        insights.append({"type": "good", "text": "当前零异常，一切正常"})

    # 7. 竞品洞察
    curr_comp = current.get('competitor', {})
    prev_comp = previous.get('competitor', {})
    if curr_comp.get('total_stores', 0) > 0 and prev_comp.get('total_stores', 0) > 0:
        # 总量变化
        curr_daily = curr_comp.get('total_daily', 0)
        prev_daily = prev_comp.get('total_daily', 0)
        if prev_daily > 0 and curr_daily > 0:
            change_pct = (curr_daily - prev_daily) / prev_daily * 100
            if change_pct > 30:
                insights.append({"type": "info", "text": f"竞品总销量涨 {change_pct:.0f}%（{prev_daily}→{curr_daily}）"})
            elif change_pct < -30:
                insights.append({"type": "info", "text": f"竞品总销量跌 {abs(change_pct):.0f}%（{prev_daily}→{curr_daily}）"})

        # 活跃店铺变化
        curr_active = curr_comp.get('active_stores', 0)
        prev_active = prev_comp.get('active_stores', 0)
        if prev_active > 0 and curr_active < prev_active - 3:
            insights.append({"type": "info", "text": f"竞品活跃店铺减少：{prev_active}→{curr_active}家"})

        # 单店暴涨/暴跌
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

    # 限制最多 5 条（竞品洞察优先级低，不挤占异常洞察）
    return insights[:5]
