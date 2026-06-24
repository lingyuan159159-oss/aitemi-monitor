#!/usr/bin/env python3
"""
艾特米数据采集主入口

GitHub Actions 定时调用此脚本，完成：
1. 验证 session
2. 拉取订单/骑手/店铺数据
3. 运行异常检测 + 跳扫码检测
4. 计算骑手统计
5. 拉取竞品数据
6. 输出 JSON 到 data/latest.json

环境变量：
  AITEMI_PHPSESSID     艾特米后台 PHPSESSID
  AITEMI_ADMINSESSION  艾特米后台 adminsession
  COMPETITOR_SESSION   一技生活圈 PHPSESSID
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# 让 scripts/ 目录可被 import
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from aitemi_api import validate_session, load_all_ops, load_all_orders, load_shop_area
from detectors import detect_anomalies, detect_skip_scans, compute_rider_stats
from competitor import fetch_all_stores, compute_competitor_data

BASE_URL = 'https://admshop.mengshimei.shop'
DATA_DIR = SCRIPT_DIR.parent / 'data'
CONFIG_PATH = DATA_DIR / 'config.json'
LATEST_PATH = DATA_DIR / 'latest.json'
STATUS_PATH = DATA_DIR / 'status.json'
HISTORY_PATH = DATA_DIR / 'competitor_history.json'
HISTORY_TRACK_PATH = DATA_DIR / 'history.json'
MAX_HISTORY = 288  # 24小时 × 每5分钟一条

# 竞品数据为空时的默认结构
EMPTY_COMPETITOR = {
    'date': '',
    'total_daily': 0,
    'total_cumul': 0,
    'active_stores': 0,
    'total_stores': 0,
    'stores': [],
}


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def get_session_from_env():
    phpsessid = os.environ.get('AITEMI_PHPSESSID', '').strip()
    adminsession = os.environ.get('AITEMI_ADMINSESSION', '').strip()
    if not phpsessid or not adminsession:
        return None
    return {'PHPSESSID': phpsessid, 'adminsession': adminsession}


def get_competitor_session():
    return os.environ.get('COMPETITOR_SESSION', '').strip()


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    now = datetime.now()
    now_str = now.strftime('%Y-%m-%dT%H:%M:%S')
    print(f"=== 艾特米数据采集 {now_str} ===", file=sys.stderr)

    # 加载配置
    try:
        config = load_config()
    except Exception as e:
        print(f"  FATAL: config.json 加载失败: {e}", file=sys.stderr)
        write_json(STATUS_PATH, {'session_valid': False, 'updated_at': now_str, 'error': str(e)})
        sys.exit(1)

    # 1. 加载 session
    session = get_session_from_env()
    if not session:
        print("  ERROR: 环境变量 AITEMI_PHPSESSID / AITEMI_ADMINSESSION 未设置", file=sys.stderr)
        write_json(STATUS_PATH, {
            'session_valid': False, 'updated_at': now_str, 'error': 'env_vars_missing',
        })
        # 仍然尝试采集竞品
        _collect_competitor(config, now_str)
        sys.exit(1)

    # 2. 验证 session
    print("=== 验证 Session ===", file=sys.stderr)
    valid, cookie = validate_session(session, BASE_URL)
    if not valid:
        print("  SESSION EXPIRED", file=sys.stderr)
        write_json(STATUS_PATH, {
            'session_valid': False, 'updated_at': now_str, 'error': 'session_expired',
        })
        _collect_competitor(config, now_str)
        sys.exit(1)

    print("  Session valid", file=sys.stderr)

    # 3. 拉取数据
    print("\n=== 拉取骑手操作 ===", file=sys.stderr)
    ops = load_all_ops(BASE_URL, cookie)

    print("\n=== 拉取订单 ===", file=sys.stderr)
    orders = load_all_orders(BASE_URL, cookie)

    print("\n=== 拉取店铺区域 ===", file=sys.stderr)
    shop_areas_api = load_shop_area(BASE_URL, cookie)

    # 4. 异常检测
    print("\n=== 异常检测 ===", file=sys.stderr)
    anomalies = detect_anomalies(orders, ops, config, shop_areas_api)
    print(f"  异常: {len(anomalies)}", file=sys.stderr)

    # 5. 跳扫码检测
    print("\n=== 跳扫码检测 ===", file=sys.stderr)
    skip_scans, skip_riders = detect_skip_scans(orders, ops, config)
    print(f"  跳扫码: {len(skip_scans)}", file=sys.stderr)

    # 6. 骑手统计
    print("\n=== 骑手统计 ===", file=sys.stderr)
    rider_stats = compute_rider_stats(orders, ops, config, shop_areas_api)
    print(f"  骑手: {len(rider_stats)}", file=sys.stderr)

    # 7. 订单概览
    delivering = [o for o in orders if o.get('is_delivering') and not o.get('is_complete') and not o.get('is_aftersale')]
    completed = [o for o in orders if o.get('is_complete')]
    aftersale = [o for o in orders if o.get('is_aftersale')]

    # 8. 竞品数据
    competitor = _collect_competitor(config, now_str)

    # 9. 汇总输出
    result = {
        'updated_at': now_str,
        'session_valid': True,
        'summary': {
            'total_orders': len(orders),
            'delivering': len(delivering),
            'completed': len(completed),
            'aftersale': len(aftersale),
            'anomaly_count': len(anomalies),
            'skip_scan_count': len(skip_scans),
        },
        'anomalies': anomalies,
        'skip_scans': skip_scans,
        'skip_scan_riders': skip_riders,
        'riders': rider_stats,
        'competitor': competitor,
        'config': config,
    }

    write_json(LATEST_PATH, result)
    write_json(STATUS_PATH, {
        'session_valid': True,
        'updated_at': now_str,
        'orders': len(orders),
        'anomalies': len(anomalies),
        'skip_scans': len(skip_scans),
    })

    # 10. 追加历史趋势数据
    _append_history(now_str, len(orders), len(delivering), len(anomalies), len(skip_scans), competitor)

    print(f"\n=== 完成 ===", file=sys.stderr)
    print(f"  订单: {len(orders)} | 异常: {len(anomalies)} | 跳扫码: {len(skip_scans)}", file=sys.stderr)
    print(f"  输出: {LATEST_PATH}", file=sys.stderr)


def _collect_competitor(config, now_str):
    """采集竞品数据，失败时返回空结构体而非 None。"""
    session_id = get_competitor_session()
    if not session_id:
        print("  COMPETITOR_SESSION 未设置，跳过竞品采集", file=sys.stderr)
        return EMPTY_COMPETITOR

    print("\n=== 竞品采集 ===", file=sys.stderr)
    try:
        stores = fetch_all_stores(session_id)
        if stores:
            competitor = compute_competitor_data(stores, str(HISTORY_PATH))
            print(f"  竞品: {competitor.get('total_stores', 0)} 店铺, 当日 {competitor.get('total_daily', 0)} 单", file=sys.stderr)
            return competitor
        else:
            print("  竞品数据为空", file=sys.stderr)
            return EMPTY_COMPETITOR
    except Exception as e:
        print(f"  竞品采集失败: {e}", file=sys.stderr)
        return EMPTY_COMPETITOR


def _append_history(now_str, total_orders, delivering, anomaly_count, skip_scan_count, competitor):
    """追加当前指标到历史趋势文件，保留最近 MAX_HISTORY 条。"""
    history = []
    if HISTORY_TRACK_PATH.exists():
        try:
            history = json.loads(HISTORY_TRACK_PATH.read_text())
        except Exception:
            history = []

    entry = {
        'time': now_str[:16],  # 精确到分钟
        'orders': total_orders,
        'delivering': delivering,
        'anomalies': anomaly_count,
        'skip_scans': skip_scan_count,
        'competitor_daily': competitor.get('total_daily', 0) if competitor else 0,
    }
    history.append(entry)

    # 只保留最近 MAX_HISTORY 条
    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]

    write_json(HISTORY_TRACK_PATH, history)
    print(f"  历史: {len(history)} 条记录", file=sys.stderr)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        write_json(STATUS_PATH, {
            'session_valid': False,
            'updated_at': datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
            'error': str(e),
        })
        sys.exit(1)
