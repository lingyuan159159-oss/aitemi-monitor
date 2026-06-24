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
  HIGH: 'bg-[#ff3b30]/10 text-[#ff3b30]',
  MED: 'bg-[#ff9500]/10 text-[#ff9500]',
  LOW: 'bg-[#ffcc00]/10 text-[#9a6700]',
  WARN: 'bg-[#86868b]/10 text-[#86868b]',
};

const severityLabels: Record<string, string> = {
  HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告',
};

function MetricCard({ icon: Icon, label, value, color, prev, onClick }: {
  icon: React.ElementType; label: string; value: number; color: string; prev?: number | null; onClick?: () => void;
}) {
  const diff = prev != null ? value - prev : null;
  return (
    <Card
      className={cn('cursor-pointer transition-all duration-200 hover:-translate-y-0.5', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', color)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="text-xs text-[#86868b] mb-0.5">{label}</div>
        <div className="text-[26px] font-semibold tracking-tight text-[#1d1d1f]">{value}</div>
        {diff != null && diff !== 0 && (
          <div className={cn('flex items-center gap-0.5 mt-1 text-xs font-medium', diff > 0 ? 'text-[#ff3b30]' : 'text-[#34c759]')}>
            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {diff > 0 ? '+' : ''}{diff}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewPanel({ data, formatTime: _formatTime }: Props) {
  if (!data) return null;
  const s = data.summary;

  const distData = [
    { name: '分拣', count: data.anomalies.filter(a => a.type === '分拣超时').length, fill: '#ff3b30' },
    { name: '投餐', count: data.anomalies.filter(a => a.type === '投餐超时').length, fill: '#ff9500' },
    { name: '配送', count: data.anomalies.filter(a => a.type === '配送超时').length, fill: '#ffcc00' },
    { name: '压单', count: data.anomalies.filter(a => a.type === '压单').length, fill: '#86868b' },
    { name: '跳扫', count: data.skip_scans.length, fill: '#af52de' },
  ];

  const typeCnt: Record<string, number> = {};
  data.anomalies.forEach(a => { typeCnt[a.type] = (typeCnt[a.type] || 0) + 1; });
  const skipCnt = data.skip_scans.length;

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

  const customTooltipStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    fontSize: '12px',
  };

  return (
    <div className="space-y-5">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Package} label="总订单" value={s.total_orders} color="bg-[#0071e3]/10 text-[#0071e3]" />
        <MetricCard icon={Truck} label="配送中" value={s.delivering} color="bg-[#34c759]/10 text-[#34c759]" />
        <MetricCard icon={AlertTriangle} label="异常" value={s.anomaly_count} color={s.anomaly_count > 0 ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[#34c759]/10 text-[#34c759]'} />
        <MetricCard icon={Clock} label="跳扫码" value={s.skip_scan_count} color={s.skip_scan_count > 0 ? 'bg-[#ff9500]/10 text-[#ff9500]' : 'bg-[#34c759]/10 text-[#34c759]'} />
        <MetricCard icon={RotateCcw} label="售后" value={s.aftersale} color="bg-[#ff9500]/10 text-[#ff9500]" />
        <MetricCard icon={CheckCircle2} label="已完成" value={s.completed} color="bg-[#34c759]/10 text-[#34c759]" />
      </div>

      {/* Collection Summary */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-[#34c759]" />
            <span className="font-medium text-[13px] text-[#1d1d1f]">
              {(() => {
                const upd = new Date(data.updated_at.includes('+') ? data.updated_at : data.updated_at + '+08:00');
                const nxt = new Date(upd.getTime() + 300000);
                const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' });
                return `采集 ${fmt(upd)} | 下次 ${fmt(nxt)}`;
              })()}
            </span>
          </div>
          {s.anomaly_count === 0 && s.skip_scan_count === 0 ? (
            <div className="flex items-center gap-2 text-[#34c759] font-medium text-[15px]">
              <CheckCircle2 className="h-5 w-5" />
              本次采集无异常，一切正常
            </div>
          ) : (
            <div className="space-y-1.5 text-[13px] mb-3">
              {typeCnt['分拣超时'] && <div className="text-[#ff3b30]">分拣超时 <strong>{typeCnt['分拣超时']}</strong> 单</div>}
              {typeCnt['投餐超时'] && <div className="text-[#ff9500]">投餐超时 <strong>{typeCnt['投餐超时']}</strong> 单</div>}
              {typeCnt['配送超时'] && <div className="text-[#9a6700]">配送超时 <strong>{typeCnt['配送超时']}</strong> 单</div>}
              {typeCnt['压单'] && <div className="text-[#86868b]">压单 <strong>{typeCnt['压单']}</strong> 单</div>}
              {skipCnt > 0 && <div className="text-[#af52de]">跳扫码 <strong>{skipCnt}</strong> 单</div>}
            </div>
          )}
          {faultList.length > 0 && (
            <>
              <div className="text-xs text-[#86868b] mb-2 mt-2">涉及骑手（按问题数排序）</div>
              <div className="flex flex-wrap gap-1.5">
                {faultList.map(([name, info]) => (
                  <Badge key={name} variant={info.count >= 3 ? 'destructive' : 'secondary'} className="text-xs rounded-full">
                    {name} {info.count}单
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">异常分布</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">订单趋势（最近）</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Current Anomalies Table */}
      {data.anomalies.length > 0 && (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">当前异常</CardTitle>
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
                    <TableCell className="font-medium text-[13px]">{a.delivery_seq || '--'}</TableCell>
                    <TableCell className="text-[13px]">{a.oid}</TableCell>
                    <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                    <TableCell className="text-[13px]">{a.elapsed_min}分钟</TableCell>
                    <TableCell className="text-[13px]">{a.rider || '--'}</TableCell>
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
