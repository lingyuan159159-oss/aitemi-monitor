#!/usr/bin/env python3
"""
艾特米数据采集主入口

支持：
- 每个采集环节独立间隔（config.scan_intervals）
- 异常去重（同一订单+类型不重复提醒）
- 命令行 --date=YYYY-MM-DD 指定日期
- 命令行 --force 强制全部采集
"""

import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from aitemi_api import validate_session, load_all_ops, load_all_orders, load_shop_area
from detectors import detect_anomalies, detect_skip_scans, compute_rider_stats
from competitor import fetch_all_stores, compute_competitor_data
from notify import process_alerts, send_daily_report, notify_failure, notify_session_expired, flush_pending_summaries
from intelligence import generate_daily_report, generate_insights

BASE_URL = 'https://admshop.mengshimei.shop'
DATA_DIR = SCRIPT_DIR.parent / 'data'
CONFIG_PATH = DATA_DIR / 'config.json'
LATEST_PATH = DATA_DIR / 'latest.json'
STATUS_PATH = DATA_DIR / 'status.json'
HISTORY_PATH = DATA_DIR / 'competitor_history.json'
HISTORY_TRACK_PATH = DATA_DIR / 'history.json'
RUNTIME_PATH = DATA_DIR / 'runtime_state.json'
MAX_HISTORY = 288

EMPTY_COMPETITOR = {
    'date': '', 'total_daily': 0, 'total_cumul': 0,
    'active_stores': 0, 'total_stores': 0, 'stores': [],
}

DATA_VERSION = '2.0.0'




def _calc_health_score(summary, anomalies, skip_scans, skip_riders, rider_stats, competitor):
    """计算健康评分（0-100）。权重：异常40% 跳扫码20% 效率20% 售后10% 竞品10%。"""
    score = 100.0
    sev_weights = {'严重': 20, '中等': 8, '轻微': 2, '警告': 1}

    # 异常严重度 (40%)
    score -= min(sum(sev_weights.get(a.get('severity', ''), 1) for a in anomalies), 40)

    # 跳扫码 (20%)
    score -= min(len(skip_scans) * 3 + sum(1 for r in skip_riders if r.get('high_risk')) * 10, 20)

    # 配送效率 (20%)
    if rider_stats:
        rates = [d['rate'] for r in rider_stats for d in (r.get('sort'), r.get('stay'), r.get('deliver'))
                 if d and d.get('total', 0) > 0 and d.get('rate', 0) > 0]
        if rates:
            score -= min(sum(rates) / len(rates) / 5, 20)

    # 售后率 (10%)
    total = summary.get('total_orders', 0)
    if total > 0:
        score -= min(summary.get('aftersale', 0) / total * 200, 10)

    # 竞品活跃度 (10%)
    if competitor and competitor.get('total_stores', 0) > 0:
        score -= min(competitor['active_stores'] / competitor['total_stores'] * 10, 10)

    return max(0, min(100, round(score)))




    phpsessid = os.environ.get('AITEMI_PHPSESSID', '').strip()
    adminsession = os.environ.get('AITEMI_ADMINSESSION', '').strip()
    if not phpsessid or not adminsession:
        return None
    return {'PHPSESSID': phpsessid, 'adminsession': adminsession}



def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_json(path, default=None):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception as e:
            print(f'Warning: Failed to load {path}: {e}', file=sys.stderr)
    return default if default is not None else {}



def should_run(state, component, interval_min):
    """判断某个组件是否该运行了。"""
    if interval_min <= 0:
        return False
    last = state.get('last_run', {}).get(component, 0)
    return (time.time() - last) >= interval_min * 60


def mark_run(state, component):
    """标记组件已运行。"""
    if 'last_run' not in state:
        state['last_run'] = {}
    state['last_run'][component] = time.time()


def dedup_anomalies(new_anomalies, seen_keys, orders_map=None):
    """去重：只有订单已完成送达才去重。"""
    # 兼容旧格式（float -> dict）
    for k, v in list(seen_keys.items()):
        if isinstance(v, (int, float)):
            seen_keys[k] = {'completed': True, 'time': v}

    result = []
    for a in new_anomalies:
        key = f"{a.get('oid', '')}_{a.get('type', '')}"
        oid = a.get('oid', '')

        is_complete = False
        if orders_map and oid in orders_map:
            o = orders_map[oid]
            is_complete = o.get('is_complete', False) or o.get('is_aftersale', False)

        if is_complete:
            seen_keys[key] = {'completed': True, 'time': time.time()}
        elif key in seen_keys and isinstance(seen_keys[key], dict) and seen_keys[key].get('completed'):
            continue
        else:
            result.append(a)

    cutoff = time.time() - 86400
    seen_keys = {k: v for k, v in seen_keys.items()
                 if isinstance(v, dict) and v.get('time', 0) > cutoff}
    return result, seen_keys


def dedup_skip_scans(new_scans, seen_keys):
    """跳扫码去重：同一骑手同一单只提醒一次。"""
    result = []
    for s in new_scans:
        key = f"{s.get('oid', '')}_{s.get('rider', '')}"
        if key not in seen_keys:
            result.append(s)
            seen_keys[key] = time.time()

    cutoff = time.time() - 86400
    seen_keys = {k: v for k, v in seen_keys.items() if isinstance(v, (int, float)) and v > cutoff}
    return result, seen_keys


def main():
    now = datetime.now()
    now_str = now.strftime('%Y-%m-%dT%H:%M:%S+08:00')
    collect_start = time.time()
    print(f"=== 艾特米数据采集 {now_str} ===", file=sys.stderr)

    config = json.load(open(CONFIG_PATH))
    runtime = load_json(RUNTIME_PATH, {})
    intervals = config.get('scan_intervals', {})
    force = '--force' in sys.argv
    date_str = None
    for arg in sys.argv[1:]:
        if arg.startswith('--date='):
            date_str = arg.split('=', 1)[1]

    # 检查采集时间范围
    time_range = config.get('scan_time_range', {'start': '11:00', 'end': '23:00'})
    if not force and not date_str:
        current_time = now.strftime('%H:%M')
        start_time = time_range.get('start', '11:00')
        end_time = time_range.get('end', '23:00')
        if start_time <= end_time:
            # 正常范围，如 11:00 - 23:00
            in_range = start_time <= current_time <= end_time
        else:
            # 跨午夜范围，如 23:00 - 07:00
            in_range = current_time >= start_time or current_time <= end_time
        if not in_range:
            print(f"  当前时间 {current_time} 不在采集范围 {start_time}-{end_time}，跳过", file=sys.stderr)
            sys.exit(0)

    phpsessid = os.environ.get('AITEMI_PHPSESSID', '').strip()
    adminsession = os.environ.get('AITEMI_ADMINSESSION', '').strip()
    session = {'PHPSESSID': phpsessid, 'adminsession': adminsession} if phpsessid and adminsession else None
    if not session:
        print("  ERROR: 环境变量未设置", file=sys.stderr)
        write_json(STATUS_PATH, {'session_valid': False, 'updated_at': now_str, 'error': 'env_vars_missing'})
        sys.exit(1)

    print("=== 验证 Session ===", file=sys.stderr)
    valid, cookie = validate_session(session, BASE_URL)
    if not valid:
        print("  SESSION EXPIRED", file=sys.stderr)
        notify_session_expired()
        write_json(STATUS_PATH, {'session_valid': False, 'updated_at': now_str, 'error': 'session_expired'})
        sys.exit(1)
    print("  Session valid", file=sys.stderr)

    # 判断哪些组件需要运行
    need_fetch = force or date_str or should_run(runtime, 'fetch', intervals.get('sort_timeout', 5))
    need_competitor = force or should_run(runtime, 'competitor', intervals.get('competitor', 1440))

    # 加载上次的结果（用于未运行的组件保持旧数据）
    prev = load_json(LATEST_PATH, {})
    prev_status = load_json(STATUS_PATH, {})

    # ===== 数据采集 =====
    if need_fetch:
        print(f"\n=== 拉取数据 ({date_str or '今天'}) ===", file=sys.stderr)
        ops = load_all_ops(BASE_URL, cookie, date_str)
        orders = load_all_orders(BASE_URL, cookie, date_str)
        shop_areas_api = load_shop_area(BASE_URL, cookie)

        # 统一店铺名格式
        for o in orders:
            s = o['shop']
            if s:
                s = s.replace('(', '（').replace(')', '）')
                s = re.sub(r'\s*（', '（', s)
                s = re.sub(r'）\s*', '）', s)
                s = re.sub(r'\s+', ' ', s).strip()
                o['shop'] = s

        print("\n=== 异常检测 ===", file=sys.stderr)
        anomalies, historical_backlogs = detect_anomalies(orders, ops, config, str(DATA_DIR / 'baseline.json'), shop_areas_api)

        print("\n=== 跳扫码检测 ===", file=sys.stderr)
        skip_scans, skip_riders = detect_skip_scans(orders, ops, config)

        print("\n=== 骑手统计 ===", file=sys.stderr)
        rider_stats = compute_rider_stats(orders, ops, config, shop_areas_api)

        # 构建订单映射（用于去重判断）
        orders_map = {o['oid']: o for o in orders if o.get('oid')}

        # 去重（只有订单完成才去重）
        seen = runtime.get('seen_anomalies', {})
        deduped, seen = dedup_anomalies(anomalies, seen, orders_map)
        runtime['seen_anomalies'] = seen
        dup_count = len(anomalies) - len(deduped)
        print(f"  去重: {dup_count} 条已完成，保留 {len(deduped)} 条活跃异常", file=sys.stderr)

        # 补全缺失的 delivery_seq
        for a in deduped:
            if not a.get('delivery_seq') and a.get('oid') in orders_map:
                a['delivery_seq'] = str(orders_map[a['oid']].get('delivery_seq', ''))

        # 跳扫码去重（同一骑手同一单不重复）
        skip_seen = runtime.get('seen_skip_scans', {})
        deduped_skip, skip_seen = dedup_skip_scans(skip_scans, skip_seen)
        runtime['seen_skip_scans'] = skip_seen
        skip_dup_count = len(skip_scans) - len(deduped_skip)
        skip_scans = deduped_skip
        if skip_dup_count > 0:
            print(f"  跳扫去重: {skip_dup_count} 条已见过，保留 {len(skip_scans)} 条", file=sys.stderr)

        delivering = [o for o in orders if o.get('is_delivering') and not o.get('is_complete') and not o.get('is_aftersale')]
        completed = [o for o in orders if o.get('is_complete')]
        aftersale = [o for o in orders if o.get('is_aftersale')]

        summary = {
            'total_orders': len(orders),
            'delivering': len(delivering),
            'completed': len(completed),
            'aftersale': len(aftersale),
            'anomaly_count': len(deduped),
            'skip_scan_count': len(skip_scans),
        }

        # 记录原始异常数（用于历史趋势）
        anomaly_breakdown = {}
        for a in anomalies:
            key = {'分拣超时': 'sort_timeout', '配送超时': 'deliver_timeout', '压单': 'backlog'}.get(a.get('type', ''), '')
            if key:
                anomaly_breakdown[key] = anomaly_breakdown.get(key, 0) + 1

        mark_run(runtime, 'fetch')
    else:
        # 使用上次的数据
        print("\n=== 跳过数据采集（未到间隔） ===", file=sys.stderr)
        deduped = prev.get('anomalies', [])
        skip_scans = prev.get('skip_scans', [])
        skip_riders = prev.get('skip_scan_riders', [])
        rider_stats = prev.get('riders', [])
        summary = prev.get('summary', {})
        anomaly_breakdown = {}

    # ===== 竞品采集 =====
    if need_competitor:
        print("\n=== 竞品采集 ===", file=sys.stderr)
        competitor = _collect_competitor(config, now_str)
        mark_run(runtime, 'competitor')
    else:
        competitor = prev.get('competitor', EMPTY_COMPETITOR)

    # ===== 输出 =====
    collect_duration = round(time.time() - collect_start, 1)

    # 健康评分
    health_score = _calc_health_score(summary, deduped, skip_scans, skip_riders, rider_stats, competitor)

    # AI 日报（保留上次的，22:30 时更新）
    ai_report_text = prev.get('ai_report', '')

    # AI 实时洞察
    insights = generate_insights(
        {'summary': summary, 'anomalies': deduped, 'skip_scans': skip_scans, 'skip_scan_riders': skip_riders, 'riders': rider_stats},
        prev,
        load_json(HISTORY_TRACK_PATH, []),
    )

    result = {
        'updated_at': now_str,
        'session_valid': True,
        'summary': summary,
        'anomalies': deduped,
        'all_anomalies': anomalies if need_fetch else prev.get('all_anomalies', []),
        'historical_backlogs': historical_backlogs if need_fetch else prev.get('historical_backlogs', []),
        'skip_scans': skip_scans,
        'skip_scan_riders': skip_riders,
        'riders': rider_stats,
        'competitor': competitor,
        'config_hash': hashlib.md5(json.dumps(config, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12],
        'collection_duration_sec': collect_duration,
        'health_score': health_score,
        'insights': insights,
        'ai_report': ai_report_text,
    }

    write_json(LATEST_PATH, result)

    # 高危骑手数
    high_risk_riders = sum(1 for r in skip_riders if r.get('high_risk', False))

    write_json(STATUS_PATH, {
        'session_valid': True,
        'updated_at': now_str,
        'orders': summary.get('total_orders', 0),
        'anomalies': summary.get('anomaly_count', 0),
        'skip_scans': summary.get('skip_scan_count', 0),
        'competitor_stores': competitor.get('total_stores', 0) if competitor else 0,
        'last_competitor_at': now_str if need_competitor else prev_status.get('last_competitor_at'),
        'rider_count': len(rider_stats) if need_fetch else prev_status.get('rider_count', 0),
        'high_risk_riders': high_risk_riders,
        'collection_duration_sec': collect_duration,
        'error': None,
        'version': DATA_VERSION,
    })
    write_json(RUNTIME_PATH, runtime)

    # 追加历史
    if need_fetch:
        _append_history(now_str, summary, competitor, anomaly_breakdown)

    # ===== 告警推送 =====
    if need_fetch and deduped:
        try:
            process_alerts(str(DATA_DIR), deduped)
        except Exception as e:
            print(f"  [NOTIFY] 告警处理失败: {e}", file=sys.stderr)

    # ===== 每日日报（22:30 自动生成）=====
    current_hour_min = now.strftime('%H:%M')
    daily_report_done = runtime.get('daily_report_date') == now.strftime('%Y-%m-%d')
    if '22:10' <= current_hour_min <= '22:50' and not daily_report_done:
        print("\n=== 生成每日日报 ===", file=sys.stderr)
        try:
            flush_pending_summaries(str(DATA_DIR))
            ai_text = generate_daily_report(summary, deduped, rider_stats, skip_scans, competitor, [])
            if ai_text:
                ai_report_text = ai_text
            send_daily_report(str(DATA_DIR), summary, competitor, deduped, ai_text)
            runtime['daily_report_date'] = now.strftime('%Y-%m-%d')
            write_json(RUNTIME_PATH, runtime)
        except Exception as e:
            print(f"  日报生成失败: {e}", file=sys.stderr)

    print(f"\n=== 完成 ===", file=sys.stderr)
    print(f"  订单: {summary.get('total_orders', 0)} | 异常: {summary.get('anomaly_count', 0)} | 跳扫码: {summary.get('skip_scan_count', 0)}", file=sys.stderr)


def _collect_competitor(config, now_str):
    session_id = os.environ.get('COMPETITOR_SESSION', '').strip()
    if not session_id:
        print("  COMPETITOR_SESSION 未设置，跳过", file=sys.stderr)
        return EMPTY_COMPETITOR
    try:
        stores = fetch_all_stores(session_id)
        if stores:
            competitor = compute_competitor_data(stores, str(HISTORY_PATH))
            print(f"  竞品: {competitor.get('total_stores', 0)} 店铺", file=sys.stderr)
            return competitor
        return EMPTY_COMPETITOR
    except Exception as e:
        print(f"  竞品采集失败: {e}", file=sys.stderr)
        return EMPTY_COMPETITOR


def _append_history(now_str, summary, competitor, breakdown):
    history = load_json(HISTORY_TRACK_PATH, [])
    entry = {
        'time': now_str[:16],  # 保留到分钟，含时区前缀
        'orders': summary.get('total_orders', 0),
        'delivering': summary.get('delivering', 0),
        'anomalies': summary.get('anomaly_count', 0),
        'skip_scans': summary.get('skip_scan_count', 0),
        'competitor_daily': competitor.get('total_daily', 0) if competitor else 0,
    }
    if breakdown:
        entry.update(breakdown)

    # 突变校验：订单数超过上次5倍，标记异常不追加
    if history:
        last_orders = history[-1].get('orders', 0)
        current_orders = entry.get('orders', 0)
        if last_orders > 0 and current_orders > last_orders * 5:
            print(f"  ⚠ 历史突变: orders {last_orders}→{current_orders}（{current_orders/last_orders:.1f}x），跳过追加", file=sys.stderr)
            return
        if last_orders == 0 and current_orders > 1000:
            print(f"  ⚠ 历史突变: orders 0→{current_orders}，跳过追加", file=sys.stderr)
            return

    history.append(entry)
    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]
    write_json(HISTORY_TRACK_PATH, history)
    print(f"  历史: {len(history)} 条", file=sys.stderr)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        try:
            notify_failure(str(e))
        except Exception:
            pass
        write_json(STATUS_PATH, {
            'session_valid': False,
            'updated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%S+08:00'),
            'error': str(e),
        })
        sys.exit(1)
