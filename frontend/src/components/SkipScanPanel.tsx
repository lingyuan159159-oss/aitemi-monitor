import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { MonitorData } from '@/lib/types';

interface Props { data: MonitorData | null; }

const severityColors: Record<string, string> = {
  HIGH: 'bg-red-500/10 text-red-500', MED: 'bg-orange-500/10 text-orange-500', LOW: 'bg-yellow-500/10 text-yellow-500',
};
const severityLabels: Record<string, string> = { HIGH: '严重', MED: '中等', LOW: '轻微' };

export function SkipScanPanel({ data }: Props) {
  if (!data) return null;
  const { skip_scans: scans, skip_scan_riders: riders } = data;
  const threshold = data.config?.skip_scan_threshold || 60;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">投餐到送达间隔 &lt; {threshold} 秒视为疑似跳扫码</p>
        </CardContent>
      </Card>

      {/* 骑手汇总 */}
      {riders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {riders.map(r => (
            <Card key={r.name} className={cn(r.high_risk && 'border-l-4 border-red-500')}>
              <CardContent className="p-3">
                <div className="font-semibold text-sm">{r.name}</div>
                <div className={cn('text-2xl font-bold', r.high_risk && 'text-red-500')}>{r.count}</div>
                <div className="text-xs text-muted-foreground">{r.high_risk ? '高风险' : '次疑似'}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 详情表格 */}
      {scans.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">全部记录（阈值: {threshold}秒）</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>严重度</TableHead>
                  <TableHead>骑手</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>店名</TableHead>
                  <TableHead>投餐时间</TableHead>
                  <TableHead>送达时间</TableHead>
                  <TableHead>间隔</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge className={severityColors[s.severity] || 'bg-muted'}>{severityLabels[s.severity] || s.severity}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{s.rider}</TableCell>
                    <TableCell>{s.oid}</TableCell>
                    <TableCell>{s.shop}</TableCell>
                    <TableCell>{s.place_time}</TableCell>
                    <TableCell>{s.deliver_time}</TableCell>
                    <TableCell className="font-bold">{s.gap_seconds}秒</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground">暂无跳扫码记录</CardContent></Card>
      )}
    </div>
  );
}
