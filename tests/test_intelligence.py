"""intelligence.py 测试（unittest）。"""

import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from intelligence import generate_insights


class TestGenerateInsights(unittest.TestCase):
    def test_anomaly_increase_warning(self):
        current = {'summary': {'anomaly_count': 10, 'total_orders': 100}}
        previous = {'summary': {'anomaly_count': 3, 'total_orders': 100}}
        result = generate_insights(current, previous, [])
        warning_texts = [i['text'] for i in result if i['type'] == 'warning']
        self.assertTrue(any('翻倍' in t or '新增' in t for t in warning_texts))

    def test_no_change_returns_empty(self):
        data = {'summary': {'anomaly_count': 5, 'total_orders': 100}, 'anomalies': [{'area': 'x', 'type': 't'}], 'skip_scan_riders': [], 'riders': []}
        self.assertEqual(generate_insights(data, data, []), [])

    def test_anomaly_decrease_good(self):
        current = {'summary': {'anomaly_count': 2, 'total_orders': 100}, 'anomalies': []}
        previous = {'summary': {'anomaly_count': 10, 'total_orders': 100}}
        result = generate_insights(current, previous, [])
        good_texts = [i['text'] for i in result if i['type'] == 'good']
        self.assertTrue(any('减少' in t for t in good_texts))

    def test_skip_scan_increase(self):
        current = {'summary': {'anomaly_count': 0, 'skip_scan_count': 8, 'total_orders': 100}}
        previous = {'summary': {'anomaly_count': 0, 'skip_scan_count': 2, 'total_orders': 100}}
        result = generate_insights(current, previous, [])
        self.assertTrue(any('跳扫码' in i['text'] for i in result if i['type'] == 'warning'))

    def test_high_risk_rider(self):
        current = {
            'summary': {'anomaly_count': 0, 'total_orders': 100},
            'skip_scan_riders': [{'name': '王师傅', 'count': 5, 'high_risk': True}],
            'riders': [], 'anomalies': [],
        }
        result = generate_insights(current, {'summary': {}}, [])
        self.assertTrue(any('王师傅' in i['text'] for i in result if i['type'] == 'warning'))

    def test_area_concentration(self):
        anomalies = [{'area': '一饭堂', 'type': '超时'}] * 6
        current = {
            'summary': {'anomaly_count': 6, 'total_orders': 100},
            'anomalies': anomalies, 'skip_scan_riders': [], 'riders': [],
        }
        result = generate_insights(current, {'summary': {}}, [])
        self.assertTrue(any('一饭堂' in i['text'] for i in result if i['type'] == 'warning'))

    def test_order_surge(self):
        current = {'summary': {'anomaly_count': 0, 'total_orders': 300}}
        previous = {'summary': {'anomaly_count': 0, 'total_orders': 100}}
        result = generate_insights(current, previous, [])
        self.assertTrue(any('突增' in i['text'] for i in result if i['type'] == 'warning'))

    def test_history_trend(self):
        history = [{'anomalies': 5}, {'anomalies': 10}, {'anomalies': 20}]
        current = {'summary': {'anomaly_count': 20, 'total_orders': 100}, 'anomalies': [], 'skip_scan_riders': [], 'riders': []}
        result = generate_insights(current, {}, history)
        self.assertTrue(any('持续上升' in i['text'] for i in result if i['type'] == 'warning'))

    def test_max_3_anomaly_insights(self):
        current = {
            'summary': {'anomaly_count': 20, 'skip_scan_count': 10, 'total_orders': 200},
            'anomalies': [{'area': '一饭堂', 'type': '超时'}] * 8,
            'skip_scan_riders': [{'name': 'A', 'count': 5, 'high_risk': True}],
            'riders': [{'name': 'B', 'area': '一饭堂', 'sort': {'rate': 80}, 'deliver': {'rate': 60}}],
        }
        result = generate_insights(current, {'summary': {'anomaly_count': 2, 'skip_scan_count': 1, 'total_orders': 50}}, [])
        anomaly_insights = [i for i in result if i['type'] != 'info']
        self.assertLessEqual(len(anomaly_insights), 3)

    def test_competitor_insight(self):
        current = {
            'summary': {'anomaly_count': 0, 'total_orders': 100},
            'competitor': {'total_stores': 10, 'active_stores': 8, 'total_daily': 200, 'stores': []},
            'anomalies': [], 'skip_scan_riders': [], 'riders': [],
        }
        previous = {
            'summary': {},
            'competitor': {'total_stores': 10, 'active_stores': 8, 'total_daily': 100, 'stores': []},
        }
        result = generate_insights(current, previous, [])
        self.assertTrue(any('竞品' in i['text'] for i in result if i['type'] == 'info'))


if __name__ == '__main__':
    unittest.main()
