// 艾特米监控数据类型定义

export interface Anomaly {
  type: string;
  oid: string;
  shop: string;
  area: string;
  elapsed_min: number;
  threshold: number;
  severity: string;
  baseline?: number;
  slope?: number;
  detail: string;
  dorm: string;
  rider: string;
  delivery_seq: string;
  scan_time?: string;
}

export interface SkipScan {
  type: string;
  oid: string;
  shop: string;
  rider: string;
  gap_seconds: number;
  severity: string;
  place_time: string;
  deliver_time: string;
  dorm: string;
  delivery_seq: string;
}

export interface SkipScanRider {
  name: string;
  count: number;
  high_risk: boolean;
  orders: { oid: string; shop: string; dorm: string; gap: number }[];
}

export interface DimStat {
  total: number;
  overtime: number;
  rate: number;
  avg: number;
}

export interface Rider {
  name: string;
  area: string;
  sort: DimStat;
  stay: DimStat;
  deliver: DimStat;
}

export interface CompetitorStore {
  id: string;
  name: string;
  total: number;
  yesterday_total: number;
  daily: number;
  hourly: number;
  score: number;
}

export interface Competitor {
  date: string;
  hour?: number;
  total_daily: number;
  total_hourly: number;
  total_cumul: number;
  active_stores: number;
  total_stores: number;
  stores: CompetitorStore[];
}

export interface Summary {
  total_orders: number;
  delivering: number;
  completed: number;
  aftersale: number;
  anomaly_count: number;
  skip_scan_count: number;
}

export interface Insight {
  type: 'warning' | 'info' | 'good';
  text: string;
}

export interface MonitorData {
  updated_at: string;
  session_valid: boolean;
  summary: Summary;
  anomalies: Anomaly[];
  all_anomalies?: Anomaly[];
  skip_scans: SkipScan[];
  skip_scan_riders: SkipScanRider[];
  riders: Rider[];
  competitor: Competitor;
  collection_duration_sec?: number;
  health_score?: number;
  insights?: Insight[];
  ai_report?: string;
  config: {
    thresholds: Record<string, { sort: number; stay: number; deliver: number }>;
    skip_scan_threshold: number;
    fetch_interval: number;
    scan_intervals?: Record<string, number>;
    scan_time_range?: { start: string; end: string };
  };
}

export interface HistoryEntry {
  time: string;
  orders: number;
  delivering: number;
  anomalies: number;
  skip_scans: number;
  competitor_daily: number;
  sort_timeout?: number;
  deliver_timeout?: number;
  backlog?: number;
}
