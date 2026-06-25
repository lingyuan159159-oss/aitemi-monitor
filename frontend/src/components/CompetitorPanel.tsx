import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { MonitorData } from '@/lib/types';
import { Store, TrendingUp, Users, BarChart3 } from 'lucide-react';

interface Props { data: MonitorData | null; }

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string; }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="text-xs text-[#86868b] mb-0.5">{label}</div>
        <div className="text-[26px] font-semibold tracking-tight text-[#1d1d1f]">{value}</div>
      </CardContent>
    </Card>
  );
}

export function CompetitorPanel({ data }: Props) {
  if (!data || !data.competitor || !data.competitor.stores) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="text-[#86868b] text-sm">暂无竞品数据</div>
        </CardContent>
      </Card>
    );
  }
  const comp = data.competitor;
  const top15 = comp.stores.slice(0, 15);

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
    <div className="space-y-4">
      <Card>
        <CardContent className="px-4 py-3 text-[13px] text-[#86868b]">数据日期: {comp.date}</CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={TrendingUp} label="当日销量" value={comp.total_daily} color="bg-[#0071e3]/10 text-[#0071e3]" />
        <MetricCard icon={BarChart3} label="累计销量" value={comp.total_cumul.toLocaleString()} color="bg-[#34c759]/10 text-[#34c759]" />
        <MetricCard icon={Users} label="活跃店铺" value={comp.active_stores} color="bg-[#34c759]/10 text-[#34c759]" />
        <MetricCard icon={Store} label="总店铺数" value={comp.total_stores} color="bg-[#86868b]/10 text-[#86868b]" />
      </div>

      {/* Daily Summary */}
      <Card>
        <CardContent className="p-5">
          <div className="text-[15px] font-semibold text-[#1d1d1f] mb-3">当日总结</div>
          <div className="space-y-2 text-[13px] text-[#1d1d1f]">
            <div>今日平台总销量 <strong className="text-[17px]">{comp.total_daily.toLocaleString()}</strong> 单，覆盖 {comp.active_stores} 家活跃店铺</div>
            {comp.stores.length > 0 && (
              <div>
                销量前三：
                {comp.stores.slice(0, 3).map((s, i) => (
                  <span key={s.id} className="ml-2">
                    <span className="text-[#86868b]">{i + 1}.</span> {s.name} <strong>{s.daily}</strong>单
                  </span>
                ))}
              </div>
            )}
            {comp.stores.length > 0 && (
              <div>
                店均日销 <strong>{Math.round(comp.total_daily / comp.active_stores)}</strong> 单
                {comp.stores.filter(s => s.daily === 0).length > 0 && (
                  <span className="text-[#86868b]">，{comp.stores.filter(s => s.daily === 0).length} 家店铺今日零单</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TOP 15 Bar Chart */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">TOP 15</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top15} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1d1d1f' }} width={75} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="daily" fill="#0071e3" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Full Ranking Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">全部排名</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>当日</TableHead>
                <TableHead>累计</TableHead>
                <TableHead>昨日累计</TableHead>
                <TableHead>评分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comp.stores.map((s, i) => (
                <TableRow key={s.id} className={s.daily === 0 ? 'opacity-40' : ''}>
                  <TableCell className="text-[13px]">{i + 1}</TableCell>
                  <TableCell className="font-medium text-[13px]">{s.name}</TableCell>
                  <TableCell className="font-semibold text-[13px]">{s.daily}</TableCell>
                  <TableCell className="text-[13px]">{s.total.toLocaleString()}</TableCell>
                  <TableCell className="text-[13px]">{s.yesterday_total.toLocaleString()}</TableCell>
                  <TableCell className="text-[13px]">{s.score || '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
