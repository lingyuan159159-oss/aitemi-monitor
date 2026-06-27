import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, Area, AreaChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import type { MonitorData } from '@/lib/types';
import type { CompetitorHistory } from '@/hooks/useMonitorData';
import { Store, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getChartTheme } from '@/lib/chartTheme';

interface Props { data: MonitorData | null; compHistory?: CompetitorHistory; }

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

export function CompetitorPanel({ data, compHistory = {} }: Props) {
  const { isDark, customTooltipStyle } = getChartTheme();
  const comp = data?.competitor;
  const top15 = useMemo(() => comp?.stores?.slice(0, 15) || [], [comp?.stores]);
  const sortedByHourly = useMemo(() => comp?.stores ? [...comp.stores].sort((a, b) => (b.hourly || 0) - (a.hourly || 0)) : [], [comp?.stores]);

  // 小时趋势：从历史数据计算每小时增量
  const hourlyTrend = useMemo(() => {
    const keys = Object.keys(compHistory).sort();
    if (keys.length < 2) return [];
    const result: { time: string; delta: number }[] = [];
    for (let i = 1; i < keys.length; i++) {
      const prev = compHistory[keys[i - 1]];
      const curr = compHistory[keys[i]];
      const prevTotal = Object.values(prev).reduce((s, st) => s + (st.sailed || 0), 0);
      const currTotal = Object.values(curr).reduce((s, st) => s + (st.sailed || 0), 0);
      const delta = Math.max(0, currTotal - prevTotal);
      // 时间标签：从 key 提取 HH:MM
      const timePart = keys[i].includes('T') ? keys[i].split('T')[1] : keys[i];
      const label = timePart.length > 5 ? timePart.slice(0, 5) : timePart;
      result.push({ time: label, delta });
    }
    return result;
  }, [compHistory]);

  // 每日对比：按天汇总增量
  const dailyComparison = useMemo(() => {
    const keys = Object.keys(compHistory).sort();
    if (keys.length < 2) return [];
    const dayMap: Record<string, { total: number; hours: number }> = {};
    let prevTotal: number | null = null;
    for (const key of keys) {
      const day = key.split('T')[0];
      const stores = compHistory[key];
      const total = Object.values(stores).reduce((s, st) => s + (st.sailed || 0), 0);
      if (prevTotal !== null) {
        const delta = Math.max(0, total - prevTotal);
        if (!dayMap[day]) dayMap[day] = { total: 0, hours: 0 };
        dayMap[day].total += delta;
        dayMap[day].hours += 1;
      }
      prevTotal = total;
    }
    return Object.entries(dayMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, { total, hours }]) => ({
        date: day.slice(5), // MM-DD
        total,
        label: `${day.slice(5)} (${hours}h)`,
      }));
  }, [compHistory]);

  if (!data || !comp || !comp.stores) {
    return (
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="p-10 text-center">
          <div className="text-[#86868b] dark:text-[#98989d] text-sm">暂无竞品数据</div>
        </CardContent>
      </Card>
    );
  }

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

      {/* Hourly Trend Line Chart */}
      {hourlyTrend.length > 1 && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardHeader className="pb-0 px-3 sm:px-6">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">小时趋势（每小时增量）</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-1 sm:px-6">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlyTrend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="compHourlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0071e3" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0071e3" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} axisLine={false} tickLine={false} interval={hourlyTrend.length > 8 ? 1 : 0} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Area type="monotone" dataKey="delta" stroke="#0071e3" strokeWidth={2.5} fill="url(#compHourlyGradient)" dot={{ r: 3, fill: '#0071e3', strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#0071e3', strokeWidth: 2, fill: '#fff' }} name="增量" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Comparison */}
      {dailyComparison.length > 1 && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardHeader className="pb-0 px-3 sm:px-6">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">每日对比</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-1 sm:px-6">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyComparison} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={32} name="日增量">
                  <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: isDark ? '#ffffff' : '#1d1d1f', fontWeight: 600 }} />
                  {dailyComparison.map((_, i) => (
                    <Cell key={i} fill={`hsl(${142 + i * 8}, 68%, ${46 - i * 2}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
              <Bar dataKey="daily" radius={[0, 6, 6, 0]} barSize={16}>
                {top15.map((_, i) => (
                  <Cell key={i} fill={`hsl(${210 + i * 4}, 85%, ${55 - i * 2}%)`} />
                ))}
                <LabelList dataKey="daily" position="right" style={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* TOP 5 Pie Chart */}
      {(() => {
        const pieData = top15.slice(0, 5).map((s, i) => ({
          name: s.name,
          value: s.daily,
          fill: ['#0071e3', '#34c759', '#ff9500', '#af52de', '#ff3b30'][i],
        }));
        return pieData.length > 0 && pieData.some(d => d.value > 0) ? (
          <Card className="dark:bg-[#1c1c1e]">
            <CardHeader className="pb-0 px-3 sm:px-6">
              <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">TOP 5 销量占比</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-1 sm:px-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : null;
      })()}

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
