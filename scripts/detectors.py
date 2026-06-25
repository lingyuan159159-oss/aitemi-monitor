"""
异常检测模块

四类异常检测 + 弹簧-阻尼基线机制 + 跳扫码检测 + 骑手统计

依赖：Python 3.8+, 纯 stdlib
"""

import json
import os
from datetime import datetime

from aitemi_api import parse_ts, get_area


# ===== 严重度中文映射 =====

_SEV_CN = {
    'HIGH': '严重',
    'MED': '中等',
    'LOW': '轻微',
    'WARN': '警告',
    'OK': '正常',
}

_SEV_ORDER = {'严重': 0, '中等': 1, '轻微': 2, '警告': 3, '正常': 4}


# ===== 工具函数 =====

def _get_threshold(area, anomaly_type, thresholds):
    """从配置获取区域+类型的阈值。"""
    th = thresholds.get(area, thresholds.get('_default', {}))
    type_key = {
        '分拣超时': 'sort', '投餐超时': 'stay', '配送超时': 'deliver'
    }.get(anomaly_type, 'sort')
    return th.get(type_key, 20)


def _load_baselines(path):
    """加载基线文件，不存在则返回空 dict。"""
    if not path:
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_baselines(path, baselines):
    """保存基线文件。"""
    if not path:
        return
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(baselines, f, ensure_ascii=False, indent=2)


def _update_baseline(baselines, key, current):
    """更新弹簧-阻尼基线，返回 (new_baseline, slope)。

    每个 key 独立维护:
      - baseline: 滑动窗口平均值
      - slope: 趋势斜率
      - history: 最近 5 次等待时长
    """
    if key not in baselines:
        baselines[key] = {
            'baseline': current,
            'slope': 0.0,
            'history': [current],
        }
        return current, 0.0

    rec = baselines[key]
    history = list(rec.get('history', []))

    # 滑动窗口
    history.append(current)
    if len(history) > 5:
        history = history[-5:]
    new_baseline = sum(history) / len(history)

    # 趋势斜率
    slope = 0.0
    if len(history) >= 4:
        recent3 = history[-3:]
        old3 = history[-6:-3] if len(history) >= 6 else history[:3]
        slope = (sum(recent3) / len(recent3)) - (sum(old3) / len(old3))

    # 写回
    rec['history'] = history
    rec['baseline'] = round(new_baseline, 2)
    rec['slope'] = round(slope, 2)
    baselines[key] = rec

    return new_baseline, slope


# ===== 弹簧-阻尼严重度判定 =====

def _classify_with_baseline(current, threshold, baseline, slope, anomaly_type=None):
    """基于弹簧-阻尼机制判定严重度。

    判定矩阵:
      压单 -> 独立判定 (>60min 严重, >45min 中等, >30min 轻微)
      超标 + slope > 3        -> 严重（持续恶化）
      超标 + ratio > 1.5      -> 严重（远超基线）
      超标 + slope > 1        -> 中等（轻微恶化）
      超标 + slope <= 1       -> 轻微（偶发超标）
      未超标 + slope > 5 + current > threshold*0.8 -> 警告（预警）
      其他                    -> 正常
    """
    # 压单独立判定
    if anomaly_type == '压单':
        if current > 60:
            return '严重'
        elif current > 45:
            return '中等'
        else:
            return '轻微'

    over = current > threshold
    ratio = current / max(baseline, 1)

    if over:
        if slope > 3:
            return '严重'   # 持续恶化
        if ratio > 1.5:
            return '严重'   # 远超基线
        if slope > 1:
            return '中等'   # 轻微恶化
        return '轻微'       # 偶发超标

    # 未超标，但有预警趋势
    if slope > 5 and current > threshold * 0.8:
        return '警告'

    return '正常'


# ===== 四类异常检测 =====

def detect_anomalies(orders, ops, config, baseline_path, shop_areas_api=None):
    """检测四类异常（弹簧-阻尼版本）。

    1. 配送超时: 投餐已完成但未送达
    2. 投餐超时: 分拣已完成但未投餐
    3. 分拣超时: 既无分拣也无投餐
    4. 压单: 分拣→投餐间隔 > 30min

    baseline_path: 基线文件路径（data/baseline.json）
    """
    now = datetime.now()
    exclude = set(config.get('exclude_shops', []))
    self_delivery = set(config.get('self_delivery_shops', []))
    press_threshold = config.get('press_order_threshold', 30)
    thresholds = config.get('thresholds', {})
    config_areas = config.get('shop_areas', {})

    baselines = _load_baselines(baseline_path)
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
                    bl_key = f"{shop}|配送超时"
                    baseline, slope = _update_baseline(baselines, bl_key, mins)
                    sev = _classify_with_baseline(mins, th, baseline, slope)
                    # 从所有操作中找骑手（送达未发生，从投餐/分拣操作中找）
                    rider = ''
                    for op in order_ops:
                        if op.get('rider'):
                            rider = op['rider']
                    anomalies.append({
                        'type': '配送超时',
                        'oid': oid,
                        'shop': shop,
                        'area': area,
                        'elapsed_min': round(mins, 1),
                        'threshold': th,
                        'severity': sev,
                        'baseline': round(baseline, 1),
                        'slope': round(slope, 1),
                        'detail': f"投餐{last_place.strftime('%H:%M')}已{mins:.0f}min未送达",
                        'dorm': o.get('dorm', ''),
                        'rider': rider,
                        'delivery_seq': str(o.get('delivery_seq', '')),
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
                    bl_key = f"{shop}|投餐超时"
                    baseline, slope = _update_baseline(baselines, bl_key, mins)
                    sev = _classify_with_baseline(mins, th, baseline, slope)
                    rider = ''
                    for op in order_ops:
                        if op['type'] == '投餐' and op.get('rider'):
                            rider = op['rider']
                    anomalies.append({
                        'type': '投餐超时',
                        'oid': oid,
                        'shop': shop,
                        'area': area,
                        'elapsed_min': round(mins, 1),
                        'threshold': th,
                        'severity': sev,
                        'baseline': round(baseline, 1),
                        'slope': round(slope, 1),
                        'detail': f"分拣{last_sort.strftime('%H:%M')}已{mins:.0f}min未投餐",
                        'dorm': o.get('dorm', ''),
                        'rider': rider,
                        'delivery_seq': str(o.get('delivery_seq', '')),
                    })
            continue

        # ③ 既无分拣也无投餐 -> 分拣超时
        if not sort_ok and not place_ok:
            th = _get_threshold(area, '分拣超时', thresholds)
            mins = (now - order_t).total_seconds() / 60
            if mins > th:
                bl_key = f"{shop}|分拣超时"
                baseline, slope = _update_baseline(baselines, bl_key, mins)
                sev = _classify_with_baseline(mins, th, baseline, slope)
                anomalies.append({
                    'type': '分拣超时',
                    'oid': oid,
                    'shop': shop,
                    'area': area,
                    'elapsed_min': round(mins, 1),
                    'threshold': th,
                    'severity': sev,
                    'baseline': round(baseline, 1),
                    'slope': round(slope, 1),
                    'detail': f"下单{mins:.0f}min未处理",
                    'dorm': o.get('dorm', ''),
                    'rider': '',
                })

    # ④ 压单检测：分拣→投餐间隔过长
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
        if gap > press_threshold:
            area = get_area(o['shop'], config_areas, shop_areas_api)
            bl_key = f"{o['shop']}|压单"
            baseline, slope = _update_baseline(baselines, bl_key, gap)
            sev = _classify_with_baseline(gap, press_threshold, baseline, slope, '压单')
            rider = ''
            for op in order_ops:
                if op['type'] == '投餐' and op.get('rider'):
                    rider = op['rider']
            anomalies.append({
                'type': '压单',
                'oid': oid,
                'shop': o['shop'],
                'area': area,
                'elapsed_min': round(gap, 1),
                'threshold': press_threshold,
                'severity': sev,
                'baseline': round(baseline, 1),
                'slope': round(slope, 1),
                'detail': f"分拣{last_sort.strftime('%H:%M')}→投餐{first_place.strftime('%H:%M')} 停留{gap:.0f}min",
                'dorm': o.get('dorm', ''),
                'rider': rider,
            })

    # 保存基线
    _save_baselines(baseline_path, baselines)

    # 按严重度排序
    anomalies.sort(key=lambda x: (
        _SEV_ORDER.get(x.get('severity', '警告'), 4),
        -x.get('elapsed_min', 0),
    ))

    return anomalies


# ===== 跳扫码检测 =====

def detect_skip_scans(orders, ops, config):
    """检测跳扫码：投餐→送达间隔 < 60秒。

    严重度: 严重(<15s), 中等(<30s), 轻微(<60s)
    累计 >= 3次 自动升级为严重

    返回 (skip_scans, rider_summaries)
    """
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
                if gap_seconds < 15:
                    sev = '严重'
                elif gap_seconds < 30:
                    sev = '中等'
                else:
                    sev = '轻微'

                skip_scans.append({
                    'type': '跳扫码',
                    'oid': oid,
                    'shop': o['shop'],
                    'area': '',
                    'rider': rider_name,
                    'gap_seconds': round(gap_seconds, 1),
                    'severity': sev,
                    'detail': f"投餐→送达仅{gap_seconds:.0f}秒",
                    'dorm': o.get('dorm', ''),
                    'place_time': last_place.strftime('%H:%M:%S'),
                    'deliver_time': last_deliver.strftime('%H:%M:%S'),
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

    # 高风险骑手自动升级
    for s in skip_scans:
        if s['rider'] in rider_stats and rider_stats[s['rider']]['count'] >= high_risk_count:
            s['severity'] = '严重'

    sev_order = {'严重': 0, '中等': 1, '轻微': 2}
    skip_scans.sort(key=lambda x: (sev_order.get(x['severity'], 3), x['gap_seconds']))

    # 构建骑手汇总
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
    """计算各骑手的超时率统计，按区域分组。

    每个骑手按区域统计三个维度：
      - 分拣: 下单→分拣完成
      - 停留: 分拣完成→投餐完成
      - 配送: 投餐完成→送达完成

    每个维度输出: total, overtime, rate, avg
    """
    thresholds = config.get('thresholds', {})
    config_areas = config.get('shop_areas', {})
    exclude = set(config.get('exclude_shops', []))

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

            sort_times = [parse_ts(op['time']) for op in r_ops
                          if op['type'] == '分拣' and op['status'] == '完成']
            place_times = [parse_ts(op['time']) for op in r_ops
                           if op['type'] == '投餐' and op['status'] == '完成']
            deliver_times = [parse_ts(op['time']) for op in r_ops
                             if op['type'] == '送达' and op['status'] == '完成']

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

    result.sort(key=lambda x: (
        x['area'],
        -(x['sort']['total'] + x['stay']['total'] + x['deliver']['total']),
    ))
    return result
