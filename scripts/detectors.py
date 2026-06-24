"""
异常检测模块

四类异常检测 + 跳扫码检测 + 骑手统计

依赖：Python 3.8+, 纯 stdlib
"""

from datetime import datetime


# ===== 工具函数 =====

def parse_ts(s):
    """解析时间字符串为 datetime 对象。"""
    try:
        return datetime.strptime(s, '%Y-%m-%d %H:%M:%S')
    except Exception:
        return None


# ===== 严重度判定 =====

def _get_threshold(area, anomaly_type, thresholds):
    """从配置获取区域+类型的阈值。"""
    th = thresholds.get(area, thresholds.get('_default', {}))
    type_key = {'分拣超时': 'sort', '投餐超时': 'stay', '配送超时': 'deliver'}.get(anomaly_type, 'sort')
    return th.get(type_key, 20)


def _classify_severity(elapsed, threshold, anomaly_type=None):
    """根据耗时和阈值判定严重度。"""
    if anomaly_type == '压单':
        # 压单独立判定：>60min HIGH, >45min MED, >30min LOW
        if elapsed > 60:
            return 'HIGH'
        elif elapsed > 45:
            return 'MED'
        else:
            return 'LOW'

    ratio = elapsed / max(threshold, 1)
    if ratio >= 1.5:
        return 'HIGH'
    elif ratio >= 1.2:
        return 'MED'
    elif ratio >= 1.0:
        return 'LOW'
    else:
        return 'WARN'


# ===== 四类异常检测 =====

def detect_anomalies(orders, ops, config, shop_areas_api=None):
    """检测四类异常：
    1. 配送超时: 投餐已完成但未送达
    2. 投餐超时: 分拣已完成但未投餐
    3. 分拣超时: 既无分拣也无投餐
    4. 压单: 分拣→投餐间隔过长
    """
    now = datetime.now()
    exclude = set(config.get('exclude_shops', []))
    self_delivery = set(config.get('self_delivery_shops', []))
    press_threshold = config.get('press_order_threshold', 30)
    thresholds = config.get('thresholds', {})
    config_areas = config.get('shop_areas', {})

    from aitemi_api import get_area

    anomalies = []

    for o in orders:
        if not o.get('is_delivering') or o.get('is_complete') or o.get('is_aftersale'):
            continue
        if o['shop'] in exclude:
            continue

        exp_t = parse_ts(o.get('exp_time', ''))
        order_t = parse_ts(o.get('order_time', ''))
        if not exp_t or not order_t:
            continue
        if now < exp_t:
            continue  # 期望时间未到

        oid = o['oid']
        shop = o['shop']
        area = get_area(shop, config_areas, shop_areas_api)
        order_ops = ops.get(oid, [])

        sort_ok = any(op['type'] == '分拣' and op['status'] == '完成' for op in order_ops)
        place_ok = any(op['type'] == '投餐' and op['status'] == '完成' for op in order_ops)
        deliver_ok = any(op['type'] == '送达' and op['status'] == '完成' for op in order_ops)

        if sort_ok and place_ok and deliver_ok:
            continue

        # ① 投餐已发生但未送达 -> 配送超时
        if shop in self_delivery:
            continue
        if place_ok and not deliver_ok:
            th = _get_threshold(area, '配送超时', thresholds)
            pt = [parse_ts(op['time']) for op in order_ops
                  if op['type'] == '投餐' and op['status'] == '完成']
            pt = [t for t in pt if t]
            if pt:
                last_place = max(pt)
                mins = (now - last_place).total_seconds() / 60
                if mins > th:
                    anomalies.append({
                        'type': '配送超时',
                        'oid': oid,
                        'shop': shop,
                        'area': area,
                        'elapsed_min': round(mins, 1),
                        'threshold': th,
                        'severity': _classify_severity(mins, th),
                        'detail': f"投餐{last_place.strftime('%H:%M')}已{mins:.0f}min未送达",
                        'place_time': last_place.strftime('%H:%M:%S'),
                        'dorm': o.get('dorm', ''),
                        'delivery_seq': o.get('delivery_seq', ''),
                    })
            continue

        # ② 分拣已发生但未投餐 -> 投餐超时
        if sort_ok and not place_ok:
            th = _get_threshold(area, '投餐超时', thresholds)
            st = [parse_ts(op['time']) for op in order_ops
                  if op['type'] == '分拣' and op['status'] == '完成']
            st = [t for t in st if t]
            if st:
                last_sort = max(st)
                mins = (now - last_sort).total_seconds() / 60
                if mins > th:
                    anomalies.append({
                        'type': '投餐超时',
                        'oid': oid,
                        'shop': shop,
                        'area': area,
                        'elapsed_min': round(mins, 1),
                        'threshold': th,
                        'severity': _classify_severity(mins, th),
                        'detail': f"分拣{last_sort.strftime('%H:%M')}已{mins:.0f}min未投餐",
                        'sort_time': last_sort.strftime('%H:%M:%S'),
                        'dorm': o.get('dorm', ''),
                        'delivery_seq': o.get('delivery_seq', ''),
                    })
            continue

        # ③ 既无分拣也无投餐 -> 分拣超时
        if not sort_ok and not place_ok:
            th = _get_threshold(area, '分拣超时', thresholds)
            mins = (now - order_t).total_seconds() / 60
            if mins > th:
                anomalies.append({
                    'type': '分拣超时',
                    'oid': oid,
                    'shop': shop,
                    'area': area,
                    'elapsed_min': round(mins, 1),
                    'threshold': th,
                    'severity': _classify_severity(mins, th),
                    'detail': f"下单{mins:.0f}min未处理",
                    'order_time': o['order_time'],
                    'dorm': o.get('dorm', ''),
                    'delivery_seq': o.get('delivery_seq', ''),
                })

    # ④ 压单检测：分拣→投餐间隔过长（严格大于阈值）
    for o in orders:
        if o.get('is_aftersale'):
            continue
        if o['shop'] in exclude or o['shop'] in self_delivery:
            continue
        oid = o['oid']
        order_ops = ops.get(oid, [])
        sort_times = []
        place_times = []
        for op in order_ops:
            t = parse_ts(op['time'])
            if not t:
                continue
            if op['type'] == '分拣' and op['status'] == '完成':
                sort_times.append(t)
            elif op['type'] == '投餐' and op['status'] == '完成':
                place_times.append(t)
        if not sort_times or not place_times:
            continue
        last_sort = max(sort_times)
        first_place = min(place_times)
        gap = (first_place - last_sort).total_seconds() / 60
        if gap > press_threshold:  # 严格大于
            area = get_area(o['shop'], config_areas, shop_areas_api)
            anomalies.append({
                'type': '压单',
                'oid': oid,
                'shop': o['shop'],
                'area': area,
                'elapsed_min': round(gap, 1),
                'threshold': press_threshold,
                'severity': _classify_severity(gap, press_threshold, '压单'),
                'detail': f"分拣{last_sort.strftime('%H:%M')}→投餐{first_place.strftime('%H:%M')} 停留{gap:.0f}min",
                'sort_time': last_sort.strftime('%H:%M:%S'),
                'place_time': first_place.strftime('%H:%M:%S'),
                'dorm': o.get('dorm', ''),
                'delivery_seq': o.get('delivery_seq', ''),
            })

    # 按严重度排序
    sev_order = {'HIGH': 0, 'MED': 1, 'LOW': 2, 'WARN': 3}
    anomalies.sort(key=lambda x: (sev_order.get(x.get('severity', 'WARN'), 4), -x.get('elapsed_min', 0)))

    return anomalies


# ===== 跳扫码检测 =====

def detect_skip_scans(orders, ops, config):
    """检测跳扫码：投餐→送达间隔 < threshold 秒。"""
    threshold = config.get('skip_scan_threshold', 60)
    high_risk_count = config.get('high_risk_count', 3)
    exclude = set(config.get('exclude_shops', []))
    self_delivery = set(config.get('self_delivery_shops', []))

    skip_scans = []
    rider_stats = {}

    for o in orders:
        if not o.get('is_delivering') and not o.get('is_complete'):
            continue
        if o.get('is_aftersale'):
            continue
        if o['shop'] in exclude or o['shop'] in self_delivery:
            continue

        oid = o['oid']
        order_ops = ops.get(oid, [])
        if not order_ops:
            continue

        rider_ops = {}
        for op in order_ops:
            t = parse_ts(op['time'])
            if not t:
                continue
            rider = op['rider']
            if rider not in rider_ops:
                rider_ops[rider] = {'place': [], 'deliver': []}
            if op['type'] == '投餐' and op['status'] == '完成':
                rider_ops[rider]['place'].append(t)
            elif op['type'] == '送达' and op['status'] == '完成':
                rider_ops[rider]['deliver'].append(t)

        for rider_name, rt in rider_ops.items():
            if not rt['place'] or not rt['deliver']:
                continue
            last_place = max(rt['place'])
            last_deliver = max(rt['deliver'])
            gap_seconds = (last_deliver - last_place).total_seconds()

            if 0 <= gap_seconds < threshold:
                sev = 'HIGH' if gap_seconds < 15 else ('MED' if gap_seconds < 30 else 'LOW')

                skip_scans.append({
                    'type': '跳扫码',
                    'oid': oid,
                    'shop': o['shop'],
                    'rider': rider_name,
                    'gap_seconds': round(gap_seconds, 1),
                    'severity': sev,
                    'place_time': last_place.strftime('%H:%M:%S'),
                    'deliver_time': last_deliver.strftime('%H:%M:%S'),
                    'dorm': o.get('dorm', ''),
                    'delivery_seq': o.get('delivery_seq', ''),
                })

                if rider_name not in rider_stats:
                    rider_stats[rider_name] = {'count': 0, 'orders': [], 'shops': set()}
                rider_stats[rider_name]['count'] += 1
                rider_stats[rider_name]['orders'].append({
                    'oid': oid,
                    'shop': o['shop'],
                    'dorm': o.get('dorm', ''),
                    'gap': gap_seconds,
                })
                rider_stats[rider_name]['shops'].add(o['shop'])

    # 高风险骑手升级
    for s in skip_scans:
        if s['rider'] in rider_stats and rider_stats[s['rider']]['count'] >= high_risk_count:
            s['severity'] = 'HIGH'

    sev_order = {'HIGH': 0, 'MED': 1, 'LOW': 2}
    skip_scans.sort(key=lambda x: (sev_order.get(x['severity'], 3), x['gap_seconds']))

    # 构建骑手汇总（shops set -> list，可 JSON 序列化）
    riders = []
    for name, stats in sorted(rider_stats.items(), key=lambda x: x[1]['count'], reverse=True):
        riders.append({
            'name': name,
            'count': stats['count'],
            'high_risk': stats['count'] >= high_risk_count,
            'orders': stats['orders'],
        })

    return skip_scans, riders


# ===== 骑手统计 =====

def compute_rider_stats(orders, ops, config, shop_areas_api=None):
    """计算各骑手的超时率统计，按区域分组。"""
    thresholds = config.get('thresholds', {})
    config_areas = config.get('shop_areas', {})
    exclude = set(config.get('exclude_shops', []))

    from aitemi_api import get_area

    rider_data = {}

    for o in orders:
        if o['shop'] in exclude:
            continue
        oid = o['oid']
        order_ops = ops.get(oid, [])
        if not order_ops:
            continue

        area = get_area(o['shop'], config_areas, shop_areas_api)

        rider_ops = {}
        for op in order_ops:
            rider = op['rider']
            if rider not in rider_ops:
                rider_ops[rider] = []
            rider_ops[rider].append(op)

        for rider_name, r_ops in rider_ops.items():
            key = (rider_name, area)
            if key not in rider_data:
                rider_data[key] = {'sort': [], 'stay': [], 'deliver': []}

            sort_times = [parse_ts(op['time']) for op in r_ops if op['type'] == '分拣' and op['status'] == '完成']
            place_times = [parse_ts(op['time']) for op in r_ops if op['type'] == '投餐' and op['status'] == '完成']
            deliver_times = [parse_ts(op['time']) for op in r_ops if op['type'] == '送达' and op['status'] == '完成']

            sort_times = [t for t in sort_times if t]
            place_times = [t for t in place_times if t]
            deliver_times = [t for t in deliver_times if t]

            order_t = parse_ts(o.get('order_time', ''))
            if order_t and sort_times:
                sort_elapsed = (max(sort_times) - order_t).total_seconds() / 60
                if sort_elapsed >= 0:
                    rider_data[key]['sort'].append(sort_elapsed)

            if sort_times and place_times:
                stay_elapsed = (min(place_times) - max(sort_times)).total_seconds() / 60
                if stay_elapsed >= 0:
                    rider_data[key]['stay'].append(stay_elapsed)

            if place_times and deliver_times:
                deliver_elapsed = (max(deliver_times) - max(place_times)).total_seconds() / 60
                if deliver_elapsed >= 0:
                    rider_data[key]['deliver'].append(deliver_elapsed)

    result = []
    for (rider, area), data in rider_data.items():
        th = thresholds.get(area, thresholds.get('_default', {}))

        def calc_dim(values, threshold):
            if not values:
                return {'total': 0, 'overtime': 0, 'rate': 0, 'avg': 0}
            total = len(values)
            overtime = sum(1 for v in values if v > threshold)
            avg = sum(values) / total
            rate = overtime / total * 100 if total else 0
            return {
                'total': total,
                'overtime': overtime,
                'rate': round(rate, 1),
                'avg': round(avg, 1),
            }

        result.append({
            'name': rider,
            'area': area,
            'sort': calc_dim(data['sort'], th.get('sort', 20)),
            'stay': calc_dim(data['stay'], th.get('stay', 15)),
            'deliver': calc_dim(data['deliver'], th.get('deliver', 15)),
        })

    result.sort(key=lambda x: (x['area'], -x['sort']['total'] - x['stay']['total'] - x['deliver']['total']))
    return result
