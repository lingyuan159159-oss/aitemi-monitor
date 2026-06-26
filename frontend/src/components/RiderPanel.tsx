import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Rider, MonitorData } from '@/lib/types';
import { Users, AlertTriangle, TrendingUp, Zap } from 'lucide-react';

interface Props { data: MonitorData | null; }

export function RiderPanel({ data }: Props) {
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  const ridersWithIssues = useMemo(() => (data?.riders || []).map(r => {
    const totalOvertime = r.sort.overtime + r.stay.overtime + r.deliver.overtime;
    const totalOrders = r.sort.total + r.stay.total + r.deliver.total;
    const maxRate = Math.max(r.sort.rate, r.stay.rate, r.deliver.rate);
    const fastDeliver = r.deliver.total > 0 && r.deliver.rate < 50
      ? Math.round(r.deliver.total * (1 - r.deliver.rate / 100))
      : 0;
    return { ...r, totalOvertime, totalOrders, maxRate, fastDeliver };
  }).sort((a, b) => b.totalOvertime - a.totalOvertime), [data?.riders]);

  if (!data || !data.riders || data.riders.length === 0) {
    return (
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="p-10 text-center">
          <div className="text-[#86868b] dark:text-[#98989d] text-sm">暂无骑手数据</div>
        </CardContent>
      </Card>
    );
  }

  const totalRiders = ridersWithIssues.length;
  const problemRiders = ridersWithIssues.filter(r => r.totalOvertime > 0).length;
  const highestRate = ridersWithIssues.length > 0 ? ridersWithIssues[0].maxRate : 0;
  const fastRiders = ridersWithIssues.filter(r => r.fastDeliver > 0).length;

  // Top 10 柱状图数据
  const top10 = ridersWithIssues.slice(0, 10).map(r => ({
    name: r.name,
    overtime: r.totalOvertime,
    rate: Math.round((r.totalOvertime / Math.max(r.totalOrders, 1)) * 100),
  }));

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
      {/* 总结文字 */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="p-3 sm:p-5">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-3 sm:gap-6 text-[13px] sm:text-[14px]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#0071e3]" />
              <span className="text-[#86868b] dark:text-[#98989d]">总骑手</span>
              <span className="font-semibold text-[#1d1d1f] dark:text-white">{totalRiders}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#ff3b30]" />
              <span className="text-[#86868b] dark:text-[#98989d]">问题骑手</span>
              <span className="font-semibold text-[#ff3b30]">{problemRiders}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#ff9500]" />
              <span className="text-[#86868b] dark:text-[#98989d]">最高超时率</span>
              <span className="font-semibold text-[#ff9500]">{highestRate}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#34c759]" />
              <span className="text-[#86868b] dark:text-[#98989d]">快速送达</span>
              <span className="font-semibold text-[#34c759]">{fastRiders}人</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 10 柱状图 */}
      {top10.length > 0 && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardHeader className="pb-0 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-[12px] sm:text-[13px] font-medium text-[#1d1d1f] dark:text-white">Top 10 骑手超时数</CardTitle>
          </CardHeader>
          <CardContent className="pt-1 sm:pt-2 px-1 sm:px-6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={top10} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#98989d' : '#86868b' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="overtime" radius={[6, 6, 0, 0]} name="超时数">
                  {top10.map((entry, i) => (
                    <Cell key={i} fill={entry.overtime >= 5 ? '#ff3b30' : entry.overtime >= 3 ? '#ff9500' : '#0071e3'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 骑手列表（按问题数排序） */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardHeader className="pb-0 px-3 sm:px-6">
          <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">骑手详情（按超时数排序）</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="space-y-2">
            {ridersWithIssues.map(r => (
              <div
                key={`${r.name}-${r.area}`}
                className={cn(
                  'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 sm:p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e] cursor-pointer hover:bg-[#ebebed] dark:hover:bg-[#3a3a3c] active:bg-[#e0e0e2] dark:active:bg-[#444446] transition-colors min-h-[60px]',
                  r.totalOvertime > 0 && 'border-l-[3px] border-l-[#ff3b30]',
                  r.totalOvertime === 0 && r.fastDeliver > 0 && 'border-l-[3px] border-l-[#34c759]'
                )}
                onClick={() => setSelectedRider(r)}
              >
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-[14px] sm:text-[13px] text-[#1d1d1f] dark:text-white min-w-[40px]">{r.name}</div>
                  {r.totalOvertime > 0 ? (
                    <div className="flex gap-1.5">
                      {r.sort.overtime > 0 && <Badge variant="destructive" className="text-[11px] rounded-full">分拣{r.sort.overtime}</Badge>}
                      {r.stay.overtime > 0 && <Badge className="text-[11px] rounded-full bg-[#ff9500]/10 text-[#ff9500] hover:bg-[#ff9500]/15">停留{r.stay.overtime}</Badge>}
                      {r.deliver.overtime > 0 && <Badge className="text-[11px] rounded-full bg-[#ffcc00]/10 text-[#9a6700] hover:bg-[#ffcc00]/15">配送{r.deliver.overtime}</Badge>}
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-[11px] rounded-full">正常</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] sm:text-sm text-[#86868b] dark:text-[#98989d]">
                  <span>分拣 {r.sort.overtime}/{r.sort.total} ({r.sort.rate}%)</span>
                  <span>压单 {r.stay.overtime}/{r.stay.total} ({r.stay.rate}%)</span>
                  <span>配送 {r.deliver.overtime}/{r.deliver.total} ({r.deliver.rate}%)</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 骑手详情弹窗 */}
      <Dialog open={!!selectedRider} onOpenChange={() => setSelectedRider(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white/90 dark:bg-[#1c1c1e] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
              {selectedRider?.name} - 骑手详情
            </DialogTitle>
          </DialogHeader>
          {selectedRider && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '分拣', data: selectedRider.sort },
                  { label: '压单', data: selectedRider.stay },
                  { label: '配送次数', data: selectedRider.deliver },
                ].map(d => (
                  <div key={d.label} className="text-center p-3 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e]">
                    <div className="text-sm text-[#86868b] dark:text-[#98989d] mb-1">{d.label}</div>
                    <div className={cn('text-xl font-semibold', d.data.rate > 20 ? 'text-[#ff3b30] dark:text-[#ff453a]' : 'text-[#1d1d1f] dark:text-white')}>
                      {d.data.rate}%
                    </div>
                    <div className="text-sm text-[#86868b] dark:text-[#98989d] mt-0.5">
                      {d.data.overtime}/{d.data.total} 超时
                    </div>
                    <div className="text-sm text-[#86868b] dark:text-[#98989d]">
                      均{d.data.avg}分钟
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
