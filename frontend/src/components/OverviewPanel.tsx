import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { MonitorData, HistoryEntry, Anomaly } from '@/lib/types';
import { SEVERITY_BADGE_CLASSES, SEVERITY_LABEL_MAP } from '@/lib/constants';
import { Package, Truck, AlertTriangle, Clock, RotateCcw, CheckCircle2, TrendingUp, TrendingDown, ChevronRight, ArrowRight } from 'lucide-react';

interface Props {
  data: MonitorData | null;
  history?: HistoryEntry[];
  formatTime: (ts: string) => string;
  onTabChange?: (tab: string) => void;
}

function MetricCard({ icon: Icon, label, value, color, prev, onClick }: {
  icon: React.ElementType; label: string; value: number; color: string; prev?: number | null; onClick?: () => void;
}) {
  const diff = prev != null ? value - prev : null;
  return (
    <Card
      className={cn('cursor-pointer transition-all duration-200 hover:-translate-y-0.5', onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-[11px] text-[#86868b] mb-0.5">{label}</div>
        <div className="text-xl font-semibold tracking-tight text-[#1d1d1f]">{value}</div>
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

export function OverviewPanel({ data, history = [], formatTime: _formatTime, onTabChange }: Props) {
  const [anomalyModalType, setAnomalyModalType] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  if (!data) return null;
  const s = data.summary;

  const distData = useMemo(() => [
    { name: '分拣', count: data.anomalies.filter(a => a.type === '分拣超时').length, fill: '#ff3b30' },
    { name: '配送', count: data.anomalies.filter(a => a.type === '配送超时').length, fill: '#ffcc00' },
    { name: '压单', count: data.anomalies.filter(a => a.type === '压单').length, fill: '#86868b' },
    { name: '跳扫', count: data.skip_scans.length, fill: '#af52de' },
  ], [data.anomalies, data.skip_scans]);

  const typeCnt: Record<string, number> = {};
  data.anomalies.forEach(a => { typeCnt[a.type] = (typeCnt[a.type] || 0) + 1; });
  const skipCnt = data.skip_scans.length;

  const { faultList } = useMemo(() => {
    const rf: Record<string, { count: number; types: Record<string, number> }> = {};
    data.anomalies.forEach(a => {
      if (!a.rider) return;
      if (!rf[a.rider]) rf[a.rider] = { count: 0, types: {} };
      rf[a.rider].count++;
      rf[a.rider].types[a.type] = (rf[a.rider].types[a.type] || 0) + 1;
    });
    data.skip_scans.forEach(s => {
      if (!s.rider) return;
      if (!rf[s.rider]) rf[s.rider] = { count: 0, types: {} };
      rf[s.rider].count++;
      rf[s.rider].types['跳扫码'] = (rf[s.rider].types['跳扫码'] || 0) + 1;
    });
    const fl = Object.entries(rf).sort((a, b) => b[1].count - a[1].count);
    return { riderFault: rf, faultList: fl };
  }, [data.anomalies, data.skip_scans]);

  const trendData = useMemo(() => {
    const buckets: Record<string, number> = {};
    history.forEach((h) => {
      const d = new Date(h.time);
      const h2 = String(d.getHours()).padStart(2, '0');
      const m = d.getMinutes() < 30 ? '00' : '30';
      const key = `${h2}:${m}`;
      buckets[key] = (buckets[key] || 0) + (h.orders || 0);
    });
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).map(([time, orders]) => ({ time, orders }));
  }, [history]);

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
      {/* Health Score */}
      {data.health_score != null && (
        <Card className={cn(
          'border-2',
          data.health_score >= 80 ? 'border-[#34c759]/30 bg-[#34c759]/5' :
          data.health_score >= 60 ? 'border-[#ff9500]/30 bg-[#ff9500]/5' :
          'border-[#ff3b30]/30 bg-[#ff3b30]/5'
        )}>
          <CardContent className="p-5 flex items-center gap-5">
            <div className={cn(
              'w-20 h-20 rounded-2xl flex items-center justify-center text-[32px] font-bold',
              data.health_score >= 80 ? 'bg-[#34c759]/15 text-[#34c759]' :
              data.health_score >= 60 ? 'bg-[#ff9500]/15 text-[#ff9500]' :
              'bg-[#ff3b30]/15 text-[#ff3b30]'
            )}>
              {data.health_score}
            </div>
            <div>
              <div className="text-[15px] font-semibold text-[#1d1d1f]">
                {data.health_score >= 80 ? '一切正常' : data.health_score >= 60 ? '有小问题' : '需要关注'}
              </div>
              <div className="text-[13px] text-[#86868b] mt-0.5">今日 {data.summary.total_orders} 单</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {data.insights && data.insights.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="text-[13px] font-medium text-[#1d1d1f] mb-2">AI 洞察</div>
            <div className="space-y-1.5">
              {data.insights.map((insight, i) => (
                <div key={i} className={cn(
                  'text-[13px] px-3 py-1.5 rounded-lg',
                  insight.type === 'warning' ? 'bg-[#ff3b30]/8 text-[#ff3b30]' :
                  insight.type === 'good' ? 'bg-[#34c759]/8 text-[#34c759]' :
                  'bg-[#0071e3]/8 text-[#0071e3]'
                )}>
                  {insight.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Daily Report */}
      {data.ai_report && (
        <Card>
          <CardContent className="p-4">
            <div className="text-[13px] font-medium text-[#1d1d1f] mb-2">📊 AI 日报</div>
            <div className="text-[13px] text-[#1d1d1f] whitespace-pre-wrap leading-relaxed">{data.ai_report}</div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Package} label="总订单" value={s.total_orders} color="bg-[#0071e3]/10 text-[#0071e3]" />
        <MetricCard icon={Truck} label="配送中" value={s.delivering} color="bg-[#34c759]/10 text-[#34c759]" onClick={() => onTabChange?.('anomalies')} />
        <MetricCard icon={AlertTriangle} label="异常" value={s.anomaly_count} color={s.anomaly_count > 0 ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[#34c759]/10 text-[#34c759]'} onClick={() => onTabChange?.('anomalies')} />
        <MetricCard icon={Clock} label="跳扫码" value={s.skip_scan_count} color={s.skip_scan_count > 0 ? 'bg-[#ff9500]/10 text-[#ff9500]' : 'bg-[#34c759]/10 text-[#34c759]'} onClick={() => onTabChange?.('skipscan')} />
        <MetricCard icon={RotateCcw} label="售后" value={s.aftersale} color="bg-[#ff9500]/10 text-[#ff9500]" />
        <MetricCard icon={CheckCircle2} label="已完成" value={s.completed} color="bg-[#34c759]/10 text-[#34c759]" />
      </div>

      {/* Collection Summary */}
      <Card className="cursor-pointer" onClick={() => (s.anomaly_count > 0 || s.skip_scan_count > 0) && setAnomalyModalType('all')}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#34c759]" />
            <span className="font-medium text-[15px] text-[#1d1d1f]">
              {(() => {
                const upd = new Date(data.updated_at.includes('+') ? data.updated_at : data.updated_at + '+08:00');
                const intervalSec = (data.config?.scan_intervals?.sort_timeout || 5) * 60;
                const nxt = new Date(upd.getTime() + intervalSec * 1000);
                const fmt = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' });
                const dur = data.collection_duration_sec;
                const durStr = dur != null ? `  |  耗时 ${dur < 1 ? '<1' : Math.round(dur)}秒` : '';
                return `采集 ${fmt(upd)}  |  下次 ${fmt(nxt)}${durStr}`;
              })()}
            </span>
          </div>
          {s.anomaly_count === 0 && s.skip_scan_count === 0 ? (
            <div className="flex items-center gap-2 text-[#34c759] font-medium text-[17px]">
              <CheckCircle2 className="h-6 w-6" />
              本次采集无异常，一切正常
            </div>
          ) : (
            <div className="space-y-2 text-[15px] mb-3">
              {typeCnt['分拣超时'] ? (
                <div className="flex items-center justify-between text-[#ff3b30] cursor-pointer hover:bg-[#ff3b30]/5 rounded-lg px-2 py-1 -mx-2" onClick={(e) => { e.stopPropagation(); setAnomalyModalType('分拣超时'); }}>
                  <span>分拣超时 <strong className="text-[17px]">{typeCnt['分拣超时']}</strong> 单</span>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </div>
              ) : null}
              {typeCnt['配送超时'] ? (
                <div className="flex items-center justify-between text-[#9a6700] cursor-pointer hover:bg-[#ffcc00]/5 rounded-lg px-2 py-1 -mx-2" onClick={(e) => { e.stopPropagation(); setAnomalyModalType('配送超时'); }}>
                  <span>配送超时 <strong className="text-[17px]">{typeCnt['配送超时']}</strong> 单</span>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </div>
              ) : null}
              {typeCnt['压单'] ? (
                <div className="flex items-center justify-between text-[#86868b] cursor-pointer hover:bg-[#86868b]/5 rounded-lg px-2 py-1 -mx-2" onClick={(e) => { e.stopPropagation(); setAnomalyModalType('压单'); }}>
                  <span>压单 <strong className="text-[17px]">{typeCnt['压单']}</strong> 单</span>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </div>
              ) : null}
              {skipCnt > 0 ? (
                <div className="flex items-center justify-between text-[#af52de] cursor-pointer hover:bg-[#af52de]/5 rounded-lg px-2 py-1 -mx-2" onClick={(e) => { e.stopPropagation(); setAnomalyModalType('skip'); }}>
                  <span>跳扫码 <strong className="text-[17px]">{skipCnt}</strong> 单</span>
                  <ChevronRight className="h-4 w-4 opacity-40" />
                </div>
              ) : null}
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

      {/* Anomaly Detail Modal */}
      <Dialog open={!!anomalyModalType} onOpenChange={() => setAnomalyModalType(null)}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f]">
              {anomalyModalType === 'all' ? '全部异常' : anomalyModalType === 'skip' ? '跳扫码记录' : anomalyModalType + '记录'}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {anomalyModalType === 'skip' ? (
              data.skip_scans.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>骑手</TableHead>
                      <TableHead>订单号</TableHead>
                      <TableHead>店名</TableHead>
                      <TableHead>投餐时间</TableHead>
                      <TableHead>送达时间</TableHead>
                      <TableHead>间隔</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.skip_scans.map((sc) => (
                      <TableRow key={sc.oid}>
                        <TableCell className="font-medium text-[13px]">{sc.rider}</TableCell>
                        <TableCell className="text-[13px]">{sc.oid}</TableCell>
                        <TableCell className="text-[13px]">{sc.shop}</TableCell>
                        <TableCell className="text-[13px]">{sc.place_time}</TableCell>
                        <TableCell className="text-[13px]">{sc.deliver_time}</TableCell>
                        <TableCell className="font-semibold text-[13px]">{sc.gap_seconds}秒</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <div className="text-center text-[#86868b] py-8">暂无跳扫码记录</div>
              )
            ) : (() => {
              const filtered = anomalyModalType === 'all'
                ? data.anomalies
                : data.anomalies.filter(a => a.type === anomalyModalType);
              return filtered.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>严重度</TableHead>
                      <TableHead>订单号</TableHead>
                      <TableHead>店名</TableHead>
                      <TableHead>耗时</TableHead>
                      <TableHead>骑手</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow key={`${a.oid}-${a.type}`} className="cursor-pointer" onClick={() => setSelectedAnomaly(a)}>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                            {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px]">{a.oid}</TableCell>
                        <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                        <TableCell className="text-[13px]">{a.elapsed_min}分钟</TableCell>
                        <TableCell className="text-[13px]">{a.rider || '--'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <div className="text-center text-[#86868b] py-8">暂无此类异常</div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Anomaly Detail Dialog */}
      <Dialog open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <DialogContent className="max-w-lg rounded-2xl bg-white/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f]">
              {selectedAnomaly?.type || '异常详情'}
            </DialogTitle>
          </DialogHeader>
          {selectedAnomaly && (
            <div className="space-y-2.5 text-[13px]">
              {[
                { label: '订单号', value: selectedAnomaly.oid },
                { label: '店铺', value: selectedAnomaly.shop },
                { label: '区域', value: selectedAnomaly.area },
                { label: '耗时', value: `${selectedAnomaly.elapsed_min} 分钟` },
                { label: '阈值', value: `${selectedAnomaly.threshold} 分钟` },
                { label: '严重度', value: selectedAnomaly.severity },
                { label: '基线', value: selectedAnomaly.baseline != null ? `${selectedAnomaly.baseline} 分钟` : '--' },
                { label: '斜率', value: selectedAnomaly.slope != null ? String(selectedAnomaly.slope) : '--' },
                { label: '骑手', value: selectedAnomaly.rider || '--' },
                { label: '宿舍', value: selectedAnomaly.dorm || '--' },
                { label: '配送序号', value: selectedAnomaly.delivery_seq || '--' },
                { label: '扫码时间', value: selectedAnomaly.scan_time || '--' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between bg-[#f5f5f7] rounded-lg px-3 py-2">
                  <span className="text-[#86868b]">{label}</span>
                  <span className="font-medium text-[#1d1d1f]">{value}</span>
                </div>
              ))}
              {selectedAnomaly.detail && (
                <div className="bg-[#f5f5f7] rounded-lg px-3 py-2">
                  <div className="text-[#86868b] mb-1">详情</div>
                  <div className="text-[#1d1d1f]">{selectedAnomaly.detail}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">订单趋势（按30分钟分段）</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="orders" fill="#0071e3" radius={[4, 4, 0, 0]} name="订单数" />
              </BarChart>
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
            <div className="overflow-x-auto">
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
                {data.anomalies.slice(0, 20).map((a) => (
                  <TableRow key={`${a.oid}-${a.type}`} className="cursor-pointer" onClick={() => setSelectedAnomaly(a)}>
                    <TableCell>
                      <Badge className={SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}>
                        {SEVERITY_LABEL_MAP[a.severity] || a.severity}
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
            </div>
            {data.anomalies.length > 20 && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-[13px] text-[#0071e3] hover:text-[#0077ed] hover:bg-[#0071e3]/5"
                  onClick={() => onTabChange?.('anomalies')}
                >
                  查看全部 {data.anomalies.length} 条
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
