"""collect_all.py 核心逻辑测试（unittest）。"""

import time
import unittest


def normalize_shop_name(name):
    import re
    if not name:
        return name
    name = name.replace('(', '（').replace(')', '）')
    name = re.sub(r'\s*（', '（', name)
    name = re.sub(r'）\s*', '）', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def _config_hash(config):
    import hashlib, json
    raw = json.dumps(config, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def _calc_health_score(summary, anomalies, skip_scans, skip_riders, rider_stats, competitor):
    score = 100.0
    sev_weights = {'严重': 20, '中等': 8, '轻微': 2, '警告': 1}
    score -= min(sum(sev_weights.get(a.get('severity', ''), 1) for a in anomalies), 40)
    score -= min(len(skip_scans) * 3 + sum(1 for r in skip_riders if r.get('high_risk')) * 10, 20)
    if rider_stats:
        rates = [d['rate'] for r in rider_stats for d in (r.get('sort'), r.get('stay'), r.get('deliver'))
                 if d and d.get('total', 0) > 0 and d.get('rate', 0) > 0]
        if rates:
            score -= min(sum(rates) / len(rates) / 5, 20)
    total = summary.get('total_orders', 0)
    if total > 0:
        score -= min(summary.get('aftersale', 0) / total * 200, 10)
    if competitor and competitor.get('total_stores', 0) > 0:
        score -= min(competitor['active_stores'] / competitor['total_stores'] * 10, 10)
    return max(0, min(100, round(score)))


def dedup_anomalies(new_anomalies, seen_keys, orders_map=None):
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
    result = []
    for s in new_scans:
        key = f"{s.get('oid', '')}_{s.get('rider', '')}"
        if key not in seen_keys:
            result.append(s)
            seen_keys[key] = time.time()
    cutoff = time.time() - 86400
    seen_keys = {k: v for k, v in seen_keys.items() if isinstance(v, (int, float)) and v > cutoff}
    return result, seen_keys


class TestNormalizeShopName(unittest.TestCase):
    def test_parens_to_fullwidth(self):
        self.assertEqual(normalize_shop_name('茉莉奶白(万达店)'), '茉莉奶白（万达店）')

    def test_strip_spaces(self):
        self.assertEqual(normalize_shop_name('瑞幸咖啡 （中心广场） '), '瑞幸咖啡（中心广场）')

    def test_empty(self):
        self.assertEqual(normalize_shop_name(''), '')
        self.assertIsNone(normalize_shop_name(None))

    def test_no_change(self):
        self.assertEqual(normalize_shop_name('蜜雪冰城'), '蜜雪冰城')


class TestConfigHash(unittest.TestCase):
    def test_returns_12_hex(self):
        h = _config_hash({'a': 1, 'b': 2})
        self.assertEqual(len(h), 12)
        self.assertTrue(all(c in '0123456789abcdef' for c in h))

    def test_deterministic(self):
        c = {'x': 10}
        self.assertEqual(_config_hash(c), _config_hash(c))

    def test_different_configs_differ(self):
        self.assertNotEqual(_config_hash({'a': 1}), _config_hash({'a': 2}))


class TestHealthScore(unittest.TestCase):
    def test_no_anomalies_is_100(self):
        self.assertEqual(_calc_health_score({'total_orders': 100, 'aftersale': 0}, [], [], [], [], None), 100)

    def test_critical_deducts_20(self):
        self.assertEqual(_calc_health_score({'total_orders': 100, 'aftersale': 0}, [{'severity': '严重'}], [], [], [], None), 80)

    def test_critical_capped_at_40(self):
        anomalies = [{'severity': '严重'}] * 5
        self.assertEqual(_calc_health_score({'total_orders': 100, 'aftersale': 0}, anomalies, [], [], [], None), 60)

    def test_skip_scans_deduct(self):
        self.assertEqual(_calc_health_score(
            {'total_orders': 100, 'aftersale': 0}, [],
            [{'oid': '1'}, {'oid': '2'}], [{'high_risk': False}], [], None,
        ), 94)

    def test_aftersale_deducts(self):
        self.assertEqual(_calc_health_score({'total_orders': 100, 'aftersale': 5}, [], [], [], [], None), 90)

    def test_competitor_deducts(self):
        self.assertEqual(_calc_health_score(
            {'total_orders': 100, 'aftersale': 0}, [], [], [], [],
            {'total_stores': 10, 'active_stores': 8},
        ), 92)

    def test_rider_efficiency_deducts(self):
        riders = [{'sort': {'total': 10, 'rate': 80}, 'stay': {'total': 0, 'rate': 0}, 'deliver': {'total': 0, 'rate': 0}}]
        self.assertEqual(_calc_health_score({'total_orders': 100, 'aftersale': 0}, [], [], [], riders, None), 84)


class TestDedupAnomalies(unittest.TestCase):
    def test_active_passes_through(self):
        result, _ = dedup_anomalies([{'oid': '100', 'type': '超时'}], {})
        self.assertEqual(len(result), 1)

    def test_completed_is_deduped(self):
        orders_map = {'100': {'is_complete': True}}
        seen = {}
        # Completed orders are filtered immediately and marked in seen
        result1, seen = dedup_anomalies([{'oid': '100', 'type': '超时'}], seen, orders_map)
        self.assertEqual(len(result1), 0)
        self.assertIn('100_超时', seen)
        # Second call: still deduped
        result2, seen = dedup_anomalies([{'oid': '100', 'type': '超时'}], seen, orders_map)
        self.assertEqual(len(result2), 0)

    def test_legacy_float_migrated_then_cleaned(self):
        # Legacy float entries are migrated to {'completed': True, 'time': v}
        # but old timestamps get cleaned up during the cutoff filter
        old_time = time.time() - 200000  # well past 24h cutoff
        seen = {'100_超时': old_time}
        result, seen = dedup_anomalies([{'oid': '100', 'type': '超时'}], seen, {})
        self.assertEqual(len(result), 0)  # filtered as completed
        self.assertEqual(seen, {})  # cleaned up because timestamp expired


class TestDedupSkipScans(unittest.TestCase):
    def test_first_passes(self):
        result, _ = dedup_skip_scans([{'oid': '1', 'rider': 'A'}], {})
        self.assertEqual(len(result), 1)

    def test_duplicate_filtered(self):
        seen = {}
        _, seen = dedup_skip_scans([{'oid': '1', 'rider': 'A'}], seen)
        result, _ = dedup_skip_scans([{'oid': '1', 'rider': 'A'}], seen)
        self.assertEqual(len(result), 0)

    def test_different_rider_passes(self):
        seen = {}
        _, seen = dedup_skip_scans([{'oid': '1', 'rider': 'A'}], seen)
        result, _ = dedup_skip_scans([{'oid': '1', 'rider': 'B'}], seen)
        self.assertEqual(len(result), 1)


if __name__ == '__main__':
    unittest.main()
