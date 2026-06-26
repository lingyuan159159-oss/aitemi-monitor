import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { MonitorData } from '@/lib/types';
import { SEVERITY_BADGE_CLASSES, SEVERITY_LABEL_MAP } from '@/lib/constants';

interface Props {
  data: MonitorData | null;
  formatTime: (ts: string) => string;
}

const typeColors: Record<string, string> = {
  '分拣超时': 'border-l-[3px] border-l-[#ff3b30]',
  '配送超时': 'border-l-[3px] border-l-[#ffcc00]',
  '压单': 'border-l-[3px] border-l-[#86868b]',
};
const typeTextColors: Record<string, string> = {
  '分拣超时': 'text-[#ff3b30]',
  '配送超时': 'text-[#9a6700]',
  '压单': 'text-[#86868b] dark:text-[#98989d]',
};

export function AnomalyPanel({ data, formatTime }: Props) {
  if (!data) return null;
  const anomalies = data.anomalies;
  const allAnomalies = data.all_anomalies || anomalies;

  // Build a Set of active anomaly keys for fast O(1) lookup
  const activeAnomalyKeys = new Set(anomalies.map(a => `${a.oid}::${a.type}`));

  const cnt: Record<string, number> = { HIGH: 0, MED: 0, LOW: 0, WARN: 0 };
  anomalies.forEach(a => { cnt[a.severity] = (cnt[a.severity] || 0) + 1; });

  const types = ['分拣超时', '配送超时', '压单'];

  return (
    <div className="space-y-4">
      {/* Collection Time */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="px-4 py-3 flex items-center gap-2 text-[13px] text-[#86868b] dark:text-[#98989d]">
          <span className="h-2 w-2 rounded-full bg-[#34c759]" />
          <span>采集时间: {formatTime(data.updated_at)}</span>
        </CardContent>
      </Card>

      {/* Severity Summary */}
      <div className="flex flex-wrap gap-1.5">
        {cnt.HIGH > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ff3b30]/10 dark:bg-[#ff453a]/15 text-[#ff3b30] dark:text-[#ff453a]">严重: {cnt.HIGH}</span>}
        {cnt.MED > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ff9500]/10 dark:bg-[#ff9f0a]/15 text-[#ff9500] dark:text-[#ff9f0a]">中等: {cnt.MED}</span>}
        {cnt.LOW > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ffcc00]/10 dark:bg-[#ffd60a]/15 text-[#9a6700] dark:text-[#ffd60a]">轻微: {cnt.LOW}</span>}
        {cnt.WARN > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#86868b]/10 dark:bg-[#98989d]/15 text-[#86868b] dark:text-[#98989d]">警告: {cnt.WARN}</span>}
      </div>

      {/* Grouped Display */}
      {types.map(type => {
        const items = anomalies.filter(a => a.type === type);
        if (items.length === 0) return null;
        return (
          <Card key={type} className={cn('overflow-hidden dark:bg-[#1c1c1e]', typeColors[type])}>
            <CardHeader className="pb-1">
              <CardTitle className={cn("text-[13px] font-medium flex items-center gap-2", typeTextColors[type] || 'text-[#1d1d1f] dark:text-white')}>
                {type}
                <Badge variant="secondary" className="text-[11px]">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-2">
                {items.map((a, i) => (
                  <div key={i} className="p-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl active:bg-[#ebebed] dark:active:bg-[#3a3a3c] transition-colors min-h-[56px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[14px] text-[#1d1d1f] dark:text-white truncate max-w-[55%]">{a.shop}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                        {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#86868b] dark:text-[#98989d]">
                      <span>{a.rider || '--'}</span>
                      <span>{a.elapsed_min}分钟/{a.threshold}分钟</span>
                      <span>{a.dorm || '--'}</span>
                      {a.baseline != null && <span>基线{a.baseline} 斜率{a.slope != null ? (a.slope >= 0 ? '+' : '') + a.slope : '--'}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block max-h-[500px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>严重度</TableHead>
                    <TableHead>配送单号</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>店名</TableHead>
                    <TableHead>宿舍</TableHead>
                    <TableHead>扫码时间</TableHead>
                    <TableHead>耗时</TableHead>
                    <TableHead>阈值</TableHead>
                    <TableHead>骑手</TableHead>
                    <TableHead>弹簧指标</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                          {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-[13px]">{a.delivery_seq || '--'}</TableCell>
                      <TableCell className="text-[13px]">
                        <span
                          className="text-[#0071e3] dark:text-[#0a84ff] font-mono cursor-pointer hover:underline"
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(a.oid); }}
                          title="点击复制"
                        >
                          {a.oid}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                      <TableCell className="text-[13px]">{a.dorm || '--'}</TableCell>
                      <TableCell className="text-[13px]">{a.scan_time || '--'}</TableCell>
                      <TableCell className="text-[13px]">{a.elapsed_min}分钟</TableCell>
                      <TableCell className="text-[13px]">{a.threshold}分钟</TableCell>
                      <TableCell className="text-[13px]">{a.rider || '--'}</TableCell>
                      <TableCell className="text-xs text-[#86868b] dark:text-[#98989d]">
                        {a.baseline != null ? `基线${a.baseline} 斜率${a.slope != null ? (a.slope >= 0 ? '+' : '') + a.slope : '--'}` : '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Today's History */}
      {allAnomalies.length > anomalies.length && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">
              今日历史（共 {allAnomalies.length} 条，已去重 {allAnomalies.length - anomalies.length} 条）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile: card list */}
            <div className="sm:hidden space-y-2">
              {allAnomalies.map((a) => (
                <div key={`${a.oid}-${a.type}`} className={cn('p-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl min-h-[56px]', !activeAnomalyKeys.has(`${a.oid}::${a.type}`) && 'opacity-50')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[14px] text-[#1d1d1f] dark:text-white truncate max-w-[55%]">{a.shop}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                      {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#86868b] dark:text-[#98989d]">
                    <span>{a.type}</span>
                    <span>{a.rider || '--'}</span>
                    <span>{a.elapsed_min}分钟</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block max-h-[500px] overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>严重度</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>店名</TableHead>
                  <TableHead>宿舍</TableHead>
                  <TableHead>耗时</TableHead>
                  <TableHead>骑手</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAnomalies.map((a) => (
                  <TableRow key={`${a.oid}-${a.type}`} className={activeAnomalyKeys.has(`${a.oid}::${a.type}`) ? '' : 'opacity-50'}>
                    <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>{SEVERITY_LABEL_MAP[a.severity] || a.severity}</span></TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>
                      <span
                        className="text-[#0071e3] dark:text-[#0a84ff] font-mono cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(a.oid); }}
                        title="点击复制"
                      >
                        {a.oid}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                    <TableCell>{a.dorm || '--'}</TableCell>
                    <TableCell>{a.elapsed_min}分钟</TableCell>
                    <TableCell>{a.rider || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {anomalies.length === 0 && allAnomalies.length === 0 && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardContent className="p-10 text-center">
            <div className="text-[#86868b] dark:text-[#98989d] text-sm">暂无异常</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
