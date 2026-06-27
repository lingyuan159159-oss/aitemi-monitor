"""notify.py 测试（unittest）。"""

import unittest
import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from notify import process_alerts, flush_pending_summaries


class TestProcessAlerts(unittest.TestCase):
    @patch('notify._send_feishu')
    def test_critical_triggers_push(self, mock_feishu):
        mock_feishu.return_value = True
        anomalies = [
            {'severity': '严重', 'type': '分拣超时', 'shop': '茉莉奶白', 'oid': '100', 'detail': '超时30分钟'},
            {'severity': '轻微', 'type': '配送慢', 'shop': '瑞幸', 'oid': '101', 'detail': '稍慢'},
        ]
        process_alerts('/tmp', anomalies)
        mock_feishu.assert_called_once()
        self.assertIn('严重', mock_feishu.call_args[0][0])

    @patch('notify._send_feishu')
    def test_medium_triggers_push(self, mock_feishu):
        mock_feishu.return_value = True
        anomalies = [{'severity': '中等', 'type': '压单', 'shop': '茶百道', 'detail': '积压5单'}]
        process_alerts('/tmp', anomalies)
        mock_feishu.assert_called_once()
        self.assertIn('中等', mock_feishu.call_args[0][0])

    @patch('notify._send_feishu')
    def test_no_critical_no_push(self, mock_feishu):
        process_alerts('/tmp', [{'severity': '轻微', 'type': '慢', 'shop': 'X', 'detail': '...'}])
        mock_feishu.assert_not_called()

    @patch('notify._send_feishu')
    def test_empty_no_push(self, mock_feishu):
        process_alerts('/tmp', [])
        mock_feishu.assert_not_called()


class TestFlushPendingSummaries(unittest.TestCase):
    @patch('notify._send_feishu')
    def test_noop(self, mock_feishu):
        flush_pending_summaries('/tmp')
        mock_feishu.assert_not_called()


if __name__ == '__main__':
    unittest.main()
