import { useState, useEffect, useCallback } from 'react';
import type { MonitorData, HistoryEntry } from '@/lib/types';

const DATA_URL = '/data/latest.json';
const CONFIG_URL = '/data/config.json';
const HISTORY_URL = '/data/history.json';
const COMP_HISTORY_URL = '/data/competitor_history.json';

export interface CompetitorHistory {
  [timestamp: string]: {
    [storeId: string]: { name: string; sailed: number; score?: number; address?: string };
  };
}

export function useMonitorData(refreshInterval: number = 300) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [compHistory, setCompHistory] = useState<CompetitorHistory>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [dataRes, configRes, compRes] = await Promise.all([
        fetch(DATA_URL + '?t=' + Date.now()),
        fetch(CONFIG_URL + '?t=' + Date.now()),
        fetch(COMP_HISTORY_URL + '?t=' + Date.now()).catch(() => null),
      ]);

      if (!dataRes.ok) throw new Error('数据加载失败');
      const monitorData = await dataRes.json();
      if (configRes.ok) {
        const config = await configRes.json();
        monitorData.config = { ...monitorData.config, ...config };
      }
      setData(monitorData);
      setError(null);

      if (compRes && compRes.ok) {
        try {
          const ch = await compRes.json();
          if (ch && typeof ch === 'object' && !Array.isArray(ch)) {
            setCompHistory(ch);
          }
        } catch { /* 静默 */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(HISTORY_URL + '?t=' + Date.now());
      if (res.ok) {
        const h = await res.json();
        setHistory(Array.isArray(h) ? h : []);
        setWarning(null);
      } else {
        setWarning(`历史数据加载失败 (${res.status})`);
      }
    } catch {
      setWarning('历史数据加载失败，请检查网络');
    }
  }, []);

  const triggerCollect = useCallback(async () => {
    try {
      const res = await fetch('/api/collect');
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'ok') {
          setTimeout(fetchData, 1000);
        }
      }
    } catch {
      // API 不可用时静默
    }
  }, [fetchData]);

  useEffect(() => {
    if (refreshInterval <= 0) {
      setLoading(false);
      return;
    }
    fetchData();
    fetchHistory();
  }, [fetchData, fetchHistory, refreshInterval]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const timer = setInterval(() => {
      fetchData();
      fetchHistory();
    }, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [refreshInterval, fetchData, fetchHistory]);

  return { data, history, compHistory, loading, error, warning, refresh: fetchData, triggerCollect };
}
