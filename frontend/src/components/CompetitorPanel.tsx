import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { MonitorData } from '@/lib/types';
import { Store, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props { data: MonitorData | null; }

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string; }) {
  return (
    <Card className="dark:bg-[#1c1c1e]">
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="text-xs text-[#86868b] dark:text-[#98989d] mb-0.5">{label}</div>
        <div className="text-[26px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

export function CompetitorPanel({ data }: Props) {
  const comp = data?.competitor;
  const top15 = useMemo(() => comp?.stores?.slice(0, 15) || [], [comp?.stores]);
  const sortedByHourly = useMemo(() => comp?.stores ? [...comp.stores].sort((a, b) => (b.hourly || 0) - (a.hourly || 0)) : [], [comp?.stores]);

  if (!data || !comp || !comp.stores) {
    return (
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="p-10 text-center">
          <div className="text-[#86868b] dark:text-[#98989d] text-sm">暂无竞品数据</div>
        </CardContent>
      </Card>
    );
  }

  const isDark = document.documentElement.classList.contains('dark');
  const customTooltipStyle = {
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    borderRadius: '12px',
    boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.08)',
    padding: '8px 12px',
    fontSize: '12px',
    color: isDark ? '#ffffff' : '#1d1d1f',
  };

  return (
    <div className="space-y-4">
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="px-4 py-3 text-[13px] text-[#86868b] dark:text-[#98989d]">数据日期: {comp.date}</CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={TrendingUp} label="当日总量" value={comp.total_daily} color="bg-[#0071e3]/10 text-[#0071e3]" />
        <MetricCard icon={TrendingUp} label="本小时增量" value={comp.total_hourly || 0} color="bg-[#ff9500]/10 text-[#ff9500]" />
        <MetricCard icon={Users} label="活跃店铺" value={comp.active_stores} color="bg-[#34c759]/10 text-[#34c759]" />
        <MetricCard icon={Store} label="总店铺数" value={comp.total_stores} color="bg-[#86868b]/10 dark:bg-[#98989d]/15 text-[#86868b] dark:text-[#98989d]" />
      </div>

      {/* Daily Summary */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="p-5">
          <div className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white mb-3">当日总结</div>
          <div className="space-y-2 text-[13px] text-[#1d1d1f] dark:text-white">
            <div>今日平台总销量 <strong className="text-[17px]">{comp.total_daily.toLocaleString()}</strong> 单，覆盖 {comp.active_stores} 家活跃店铺</div>
            <div>本小时增量 <strong className="text-[17px]">{(comp.total_hourly || 0).toLocaleString()}</strong> 单（{comp.hour || '--'}:00 对比上一小时）</div>
            {comp.stores.length > 0 && (
              <div>
                小时增量前三：
                {sortedByHourly.slice(0, 3).map((s, i) => (
                  <span key={s.id} className="ml-2">
                    <span className="text-[#86868b] dark:text-[#98989d]">{i + 1}.</span> {s.name} <strong>+{s.hourly || 0}</strong>
                  </span>
                ))}
              </div>
            )}
            {comp.stores.length > 0 && (
              <div>
                店均日销 <strong>{comp.active_stores > 0 ? Math.round(comp.total_daily / comp.active_stores) : '--'}</strong> 单
                {comp.stores.filter(s => s.daily === 0).length > 0 && (
                  <span className="text-[#86868b] dark:text-[#98989d]">，{comp.stores.filter(s => s.daily === 0).length} 家店铺今日零单</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 7-Day Trend Note */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="p-4">
          <div className="text-[13px] text-[#86868b] dark:text-[#98989d] flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#0071e3]" />
            竞品数据按小时存储，保留 7 天历史。可在历史页面查看趋势。
          </div>
        </CardContent>
      </Card>

      {/* TOP 15 Bar Chart */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardHeader className="pb-0 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-[12px] sm:text-[13px] font-medium text-[#1d1d1f] dark:text-white">TOP 15</CardTitle>
        </CardHeader>
        <CardContent className="pt-1 sm:pt-2 px-0 sm:px-6">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top15} layout="vertical" margin={{ left: 65, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#ffffff' : '#1d1d1f' }} width={60} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="daily" fill="#0071e3" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Full Ranking - mobile cards + desktop table */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardHeader className="pb-0 px-3 sm:px-6">
          <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">全部排名</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-1.5">
            {comp.stores.map((s, i) => (
              <div key={s.id} className={cn('flex items-center gap-3 p-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl min-h-[48px]', s.daily === 0 && 'opacity-40')}>
                <span className="text-[12px] text-[#86868b] dark:text-[#98989d] w-6 text-center">{i + 1}</span>
                <span className="font-medium text-[13px] text-[#1d1d1f] dark:text-white flex-1 truncate">{s.name}</span>
                <span className="font-semibold text-[14px] text-[#1d1d1f] dark:text-white">{s.daily}</span>
                <span className="text-[12px] text-[#86868b] dark:text-[#98989d] w-12 text-right">{s.hourly >= 0 ? `+${s.hourly}` : s.hourly}</span>
                <span className="text-[12px] text-[#86868b] dark:text-[#98989d] w-16 text-right">{s.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden sm:block max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>当日</TableHead>
                <TableHead>小时增量</TableHead>
                <TableHead>累计</TableHead>
                <TableHead>评分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comp.stores.map((s, i) => (
                <TableRow key={s.id} className={s.daily === 0 ? 'opacity-40' : ''}>
                  <TableCell className="text-[13px]">{i + 1}</TableCell>
                  <TableCell className="font-medium text-[13px]">{s.name}</TableCell>
                  <TableCell className="font-semibold text-[13px]">{s.daily}</TableCell>
                  <TableCell className="text-[13px]">{s.hourly || 0}</TableCell>
                  <TableCell className="text-[13px]">{s.total.toLocaleString()}</TableCell>
                  <TableCell className="text-[13px]">{s.score || '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
