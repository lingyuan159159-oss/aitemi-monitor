import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart } from 'recharts';
import type { MonitorData } from '@/lib/types';
import { Package, Truck, AlertTriangle, Clock, RotateCcw, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

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

const severityLabels: Record<string, string> = {
  HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告',
};

function MetricCard({ icon: Icon, label, value, color, prev, onClick }: {
  icon: React.ElementType; label: string; value: number; color: string; prev?: number | null; onClick?: () => void;
}) {
  const diff = prev != null ? value - prev : null;
  return (
    <Card className={cn('cursor-pointer hover:shadow-md transition-shadow', onClick && 'cursor-pointer')} onClick={onClick}>
      <CardContent className="p-4">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        {diff != null && diff !== 0 && (
          <div className={cn('flex items-center gap-1 mt-1 text-xs font-medium', diff > 0 ? 'text-red-500' : 'text-green-500')}>
            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {diff > 0 ? '+' : ''}{diff}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewPanel({ data, formatTime }: Props) {
  if (!data) return null;
  const s = data.summary;

  // 异常分布数据
  const distData = [
    { name: '分拣', count: data.anomalies.filter(a => a.type === '分拣超时').length, fill: '#ef4444' },
    { name: '投餐', count: data.anomalies.filter(a => a.type === '投餐超时').length, fill: '#f97316' },
    { name: '配送', count: data.anomalies.filter(a => a.type === '配送超时').length, fill: '#eab308' },
    { name: '压单', count: data.anomalies.filter(a => a.type === '压单').length, fill: '#6b7280' },
    { name: '跳扫', count: data.skip_scans.length, fill: '#8b5cf6' },
  ];

  // 采集总结
  const typeCnt: Record<string, number> = {};
  data.anomalies.forEach(a => { typeCnt[a.type] = (typeCnt[a.type] || 0) + 1; });
  const skipCnt = data.skip_scans.length;

  // 责任人
  const riderFault: Record<string, { count: number; types: Record<string, number> }> = {};
  data.anomalies.forEach(a => {
    if (!a.rider) return;
    if (!riderFault[a.rider]) riderFault[a.rider] = { count: 0, types: {} };
    riderFault[a.rider].count++;
    riderFault[a.rider].types[a.type] = (riderFault[a.rider].types[a.type] || 0) + 1;
  });
  data.skip_scans.forEach(s => {
    if (!s.rider) return;
    if (!riderFault[s.rider]) riderFault[s.rider] = { count: 0, types: {} };
    riderFault[s.rider].count++;
    riderFault[s.rider].types['跳扫码'] = (riderFault[s.rider].types['跳扫码'] || 0) + 1;
  });
  const faultList = Object.entries(riderFault).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-4">
      {/* 指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Package} label="总订单" value={s.total_orders} color="bg-blue-500/10 text-blue-500" />
        <MetricCard icon={Truck} label="配送中" value={s.delivering} color="bg-green-500/10 text-green-500" />
        <MetricCard icon={AlertTriangle} label="异常" value={s.anomaly_count} color={s.anomaly_count > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'} />
        <MetricCard icon={Clock} label="跳扫码" value={s.skip_scan_count} color={s.skip_scan_count > 0 ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'} />
        <MetricCard icon={RotateCcw} label="售后" value={s.aftersale} color="bg-orange-500/10 text-orange-500" />
        <MetricCard icon={CheckCircle2} label="已完成" value={s.completed} color="bg-green-500/10 text-green-500" />
      </div>

      {/* 采集总结卡片 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="font-semibold text-sm">采集 {formatTime(data.updated_at)} | 下次 {formatTime(new Date(new Date(data.updated_at.includes('+') ? data.updated_at : data.updated_at + '+08:00').getTime() + 300000).toISOString())}</span>
          </div>
          {s.anomaly_count === 0 && s.skip_scan_count === 0 ? (
            <div className="text-green-500 font-semibold">本次采集无异常，一切正常</div>
          ) : (
            <div className="space-y-1 text-sm mb-3">
              {typeCnt['分拣超时'] && <div className="text-red-500">分拣超时 <strong>{typeCnt['分拣超时']}</strong> 单</div>}
              {typeCnt['投餐超时'] && <div className="text-orange-500">投餐超时 <strong>{typeCnt['投餐超时']}</strong> 单</div>}
              {typeCnt['配送超时'] && <div className="text-yellow-500">配送超时 <strong>{typeCnt['配送超时']}</strong> 单</div>}
              {typeCnt['压单'] && <div className="text-muted-foreground">压单 <strong>{typeCnt['压单']}</strong> 单</div>}
              {skipCnt > 0 && <div className="text-purple-500">跳扫码 <strong>{skipCnt}</strong> 单</div>}
            </div>
          )}
          {faultList.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mb-2">涉及骑手（按问题数排序）</div>
              <div className="flex flex-wrap gap-1">
                {faultList.map(([name, info]) => (
                  <Badge key={name} variant={info.count >= 3 ? 'destructive' : 'secondary'} className="text-xs">
                    {name} {info.count}单
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 图表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">异常分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">订单趋势（最近）</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 当前异常表格 */}
      {data.anomalies.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">当前异常</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>严重度</TableHead>
                  <TableHead>配送单号</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>店名</TableHead>
                  <TableHead>耗时</TableHead>
                  <TableHead>骑手</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.anomalies.slice(0, 20).map((a, i) => (
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
                    <TableCell>{a.rider || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
