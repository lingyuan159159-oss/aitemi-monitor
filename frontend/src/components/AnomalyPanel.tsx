import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { MonitorData } from '@/lib/types';

interface Props {
  data: MonitorData | null;
  formatTime: (ts: string) => string;
}

const severityColors: Record<string, string> = {
  HIGH: 'bg-[#ff3b30]/10 text-[#ff3b30]',
  MED: 'bg-[#ff9500]/10 text-[#ff9500]',
  LOW: 'bg-[#ffcc00]/10 text-[#9a6700]',
  WARN: 'bg-[#86868b]/10 text-[#86868b]',
};
const severityLabels: Record<string, string> = { HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告' };

const typeColors: Record<string, string> = {
  '分拣超时': 'border-l-[3px] border-l-[#ff3b30]',
  '投餐超时': 'border-l-[3px] border-l-[#ff9500]',
  '配送超时': 'border-l-[3px] border-l-[#ffcc00]',
  '压单': 'border-l-[3px] border-l-[#86868b]',
};

export function AnomalyPanel({ data, formatTime }: Props) {
  if (!data) return null;
  const anomalies = data.anomalies;

  const cnt: Record<string, number> = { HIGH: 0, MED: 0, LOW: 0, WARN: 0 };
  anomalies.forEach(a => { cnt[a.severity] = (cnt[a.severity] || 0) + 1; });

  const types = ['分拣超时', '投餐超时', '配送超时', '压单'];

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
        {cnt.HIGH > 0 && <Badge className="bg-[#ff3b30]/10 text-[#ff3b30]">严重: {cnt.HIGH}</Badge>}
        {cnt.MED > 0 && <Badge className="bg-[#ff9500]/10 text-[#ff9500]">中等: {cnt.MED}</Badge>}
        {cnt.LOW > 0 && <Badge className="bg-[#ffcc00]/10 text-[#9a6700]">轻微: {cnt.LOW}</Badge>}
        {cnt.WARN > 0 && <Badge variant="secondary">警告: {cnt.WARN}</Badge>}
      </div>

      {/* Grouped Display */}
      {types.map(type => {
        const items = anomalies.filter(a => a.type === type);
        if (items.length === 0) return null;
        return (
          <Card key={type} className={cn('overflow-hidden', typeColors[type])}>
            <CardHeader className="pb-1">
              <CardTitle className="text-[13px] font-medium text-[#1d1d1f] flex items-center gap-2">
                {type}
                <Badge variant="secondary" className="text-[11px]">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>严重度</TableHead>
                    <TableHead>配送单号</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>店名</TableHead>
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
                        <Badge className={severityColors[a.severity] || severityColors.WARN}>
                          {severityLabels[a.severity] || a.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-[13px]">{a.delivery_seq || '--'}</TableCell>
                      <TableCell className="text-[13px]">{a.oid}</TableCell>
                      <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
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
            </CardContent>
          </Card>
        );
      })}

      {anomalies.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="text-[#86868b] text-sm">暂无异常</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
