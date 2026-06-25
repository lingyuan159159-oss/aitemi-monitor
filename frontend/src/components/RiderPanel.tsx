import { useState } from 'react';
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

  if (!data || data.riders.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="text-[#86868b] text-sm">暂无骑手数据</div>
        </CardContent>
      </Card>
    );
  }

  // 计算每个骑手的问题总数（超时数之和）和快速送达数
  const ridersWithIssues = data.riders.map(r => {
    const totalOvertime = r.sort.overtime + r.stay.overtime + r.deliver.overtime;
    const totalOrders = r.sort.total + r.stay.total + r.deliver.total;
    const maxRate = Math.max(r.sort.rate, r.stay.rate, r.deliver.rate);
    // 快速送达：配送平均时间 < 阈值50% 的次数（rate低说明快）
    const fastDeliver = r.deliver.total > 0 && r.deliver.rate < 50
      ? Math.round(r.deliver.total * (1 - r.deliver.rate / 100))
      : 0;
    return { ...r, totalOvertime, totalOrders, maxRate, fastDeliver };
  }).sort((a, b) => b.totalOvertime - a.totalOvertime);

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
      {/* 总结文字 */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-6 text-[14px]">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#0071e3]" />
              <span className="text-[#86868b]">总骑手</span>
              <span className="font-semibold text-[#1d1d1f]">{totalRiders}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#ff3b30]" />
              <span className="text-[#86868b]">问题骑手</span>
              <span className="font-semibold text-[#ff3b30]">{problemRiders}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#ff9500]" />
              <span className="text-[#86868b]">最高超时率</span>
              <span className="font-semibold text-[#ff9500]">{highestRate}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#34c759]" />
              <span className="text-[#86868b]">快速送达</span>
              <span className="font-semibold text-[#34c759]">{fastRiders}人</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 10 柱状图 */}
      {top10.length > 0 && (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">Top 10 骑手超时数</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={top10}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} axisLine={false} tickLine={false} />
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
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">骑手详情（按超时数排序）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {ridersWithIssues.map(r => (
              <div
                key={r.name}
                className={cn(
                  'flex items-center gap-4 p-3.5 rounded-2xl bg-[#f5f5f7] cursor-pointer hover:bg-[#ebebed] transition-colors',
                  r.totalOvertime > 0 && 'border-l-[3px] border-l-[#ff3b30]',
                  r.totalOvertime === 0 && r.fastDeliver > 0 && 'border-l-[3px] border-l-[#34c759]'
                )}
                onClick={() => setSelectedRider(r)}
              >
                <div className="w-16">
                  <div className="font-semibold text-[13px] text-[#1d1d1f]">{r.name}</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {r.totalOvertime > 0 ? (
                      <Badge variant="destructive" className="text-[11px] rounded-full">{r.totalOvertime}次超时</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px] rounded-full">正常</Badge>
                    )}
                    {r.fastDeliver > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#34c759]/10 text-[#34c759]">
                        {r.fastDeliver}次快速送达
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-sm text-[#86868b]">
                    <span>分拣 {r.sort.overtime}/{r.sort.total} ({r.sort.rate}%)</span>
                    <span>压单 {r.stay.overtime}/{r.stay.total} ({r.stay.rate}%)</span>
                    <span>配送次数 {r.deliver.overtime}/{r.deliver.total} ({r.deliver.rate}%)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 骑手详情弹窗 */}
      <Dialog open={!!selectedRider} onOpenChange={() => setSelectedRider(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f]">
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
                  <div key={d.label} className="text-center p-3 rounded-xl bg-[#f5f5f7]">
                    <div className="text-sm text-[#86868b] mb-1">{d.label}</div>
                    <div className={cn('text-xl font-semibold', d.data.rate > 20 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]')}>
                      {d.data.rate}%
                    </div>
                    <div className="text-sm text-[#86868b] mt-0.5">
                      {d.data.overtime}/{d.data.total} 超时
                    </div>
                    <div className="text-sm text-[#86868b]">
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
