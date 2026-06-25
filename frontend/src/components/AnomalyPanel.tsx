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
  '压单': 'text-[#86868b]',
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
      <Card>
        <CardContent className="px-4 py-3 flex items-center gap-2 text-[13px] text-[#86868b]">
          <span className="h-2 w-2 rounded-full bg-[#34c759]" />
          <span>采集时间: {formatTime(data.updated_at)}</span>
        </CardContent>
      </Card>

      {/* Severity Summary */}
      <div className="flex flex-wrap gap-1.5">
        {cnt.HIGH > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ff3b30]/10 text-[#ff3b30]">严重: {cnt.HIGH}</span>}
        {cnt.MED > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ff9500]/10 text-[#ff9500]">中等: {cnt.MED}</span>}
        {cnt.LOW > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ffcc00]/10 text-[#9a6700]">轻微: {cnt.LOW}</span>}
        {cnt.WARN > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#86868b]/10 text-[#86868b]">警告: {cnt.WARN}</span>}
      </div>

      {/* Grouped Display */}
      {types.map(type => {
        const items = anomalies.filter(a => a.type === type);
        if (items.length === 0) return null;
        return (
          <Card key={type} className={cn('overflow-hidden', typeColors[type])}>
            <CardHeader className="pb-1">
              <CardTitle className={cn("text-[13px] font-medium flex items-center gap-2", typeTextColors[type] || 'text-[#1d1d1f]')}>
                {type}
                <Badge variant="secondary" className="text-[11px]">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
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
                      <TableCell className="text-[13px]">{a.oid}</TableCell>
                      <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                      <TableCell className="text-[13px]">{a.dorm || '--'}</TableCell>
                      <TableCell className="text-[13px]">{a.scan_time || '--'}</TableCell>
                      <TableCell className="text-[13px]">{a.elapsed_min}分钟</TableCell>
                      <TableCell className="text-[13px]">{a.threshold}分钟</TableCell>
                      <TableCell className="text-[13px]">{a.rider || '--'}</TableCell>
                      <TableCell className="text-xs text-[#86868b]">
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
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">
              今日历史（共 {allAnomalies.length} 条，已去重 {allAnomalies.length - anomalies.length} 条）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
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
                    <TableCell>{a.oid}</TableCell>
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
        <Card>
          <CardContent className="p-10 text-center">
            <div className="text-[#86868b] text-sm">暂无异常</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
