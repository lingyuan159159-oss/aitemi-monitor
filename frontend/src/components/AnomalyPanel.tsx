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
  HIGH: 'bg-red-500/10 text-red-500 border-red-500/20',
  MED: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  LOW: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  WARN: 'bg-muted text-muted-foreground border-border',
};
const severityLabels: Record<string, string> = { HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告' };

const typeColors: Record<string, string> = {
  '分拣超时': 'border-l-4 border-red-500',
  '投餐超时': 'border-l-4 border-orange-500',
  '配送超时': 'border-l-4 border-yellow-500',
  '压单': 'border-l-4 border-gray-400',
};

export function AnomalyPanel({ data, formatTime }: Props) {
  if (!data) return null;
  const anomalies = data.anomalies;

  const cnt: Record<string, number> = { HIGH: 0, MED: 0, LOW: 0, WARN: 0 };
  anomalies.forEach(a => { cnt[a.severity] = (cnt[a.severity] || 0) + 1; });

  const types = ['分拣超时', '投餐超时', '配送超时', '压单'];

  return (
    <div className="space-y-4">
      {/* 采集时间 */}
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span>采集时间: {formatTime(data.updated_at)}</span>
        </CardContent>
      </Card>

      {/* 严重度摘要 */}
      <div className="flex flex-wrap gap-2">
        {cnt.HIGH > 0 && <Badge className="bg-red-500/10 text-red-500">严重: {cnt.HIGH}</Badge>}
        {cnt.MED > 0 && <Badge className="bg-orange-500/10 text-orange-500">中等: {cnt.MED}</Badge>}
        {cnt.LOW > 0 && <Badge className="bg-yellow-500/10 text-yellow-500">轻微: {cnt.LOW}</Badge>}
        {cnt.WARN > 0 && <Badge variant="secondary">警告: {cnt.WARN}</Badge>}
      </div>

      {/* 分组展示 */}
      {types.map(type => {
        const items = anomalies.filter(a => a.type === type);
        if (items.length === 0) return null;
        return (
          <Card key={type} className={cn('overflow-hidden', typeColors[type])}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {type}
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
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
                      <TableCell className="font-medium">{a.delivery_seq || '--'}</TableCell>
                      <TableCell>{a.oid}</TableCell>
                      <TableCell className="font-medium">{a.shop}</TableCell>
                      <TableCell>{a.elapsed_min}分钟</TableCell>
                      <TableCell>{a.threshold}分钟</TableCell>
                      <TableCell>{a.rider || '--'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
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
          <CardContent className="p-8 text-center text-muted-foreground">暂无异常</CardContent>
        </Card>
      )}
    </div>
  );
}
