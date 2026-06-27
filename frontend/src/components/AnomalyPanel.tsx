import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, copyToClipboard } from '@/lib/utils';
import type { MonitorData, Anomaly } from '@/lib/types';
import { SEVERITY_BADGE_CLASSES, SEVERITY_LABEL_MAP, TYPE_BADGE_CLASSES } from '@/lib/constants';

interface Props {
  data: MonitorData | null;
  formatTime: (ts: string) => string;
}

const typeColors: Record<string, string> = {
  '分拣超时': 'border-l-[3px] border-l-[#ff3b30]',
  '配送超时': 'border-l-[3px] border-l-[#ffcc00]',
  '压单': 'border-l-[3px] border-l-[#86868b]',
};
const typeTextColors: Record<string, string> = {
  '分拣超时': 'text-[#ff3b30]',
  '配送超时': 'text-[#9a6700]',
  '压单': 'text-[#86868b] dark:text-[#98989d]',
};

export function AnomalyPanel({ data, formatTime }: Props) {
  const [selectedShop, setSelectedShop] = useState<string>('__all__');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);

  if (!data) return null;
  const anomalies = data.anomalies;
  const allAnomalies = data.all_anomalies || anomalies;

  const shopNames = useMemo(() => {
    const set = new Set<string>();
    anomalies.forEach(a => { if (a.shop) set.add(a.shop); });
    return Array.from(set).sort();
  }, [anomalies]);

  const filteredAnomalies = useMemo(() =>
    selectedShop === '__all__' ? anomalies : anomalies.filter(a => a.shop === selectedShop),
    [anomalies, selectedShop]
  );

  const filteredAllAnomalies = useMemo(() =>
    selectedShop === '__all__' ? allAnomalies : allAnomalies.filter(a => a.shop === selectedShop),
    [allAnomalies, selectedShop]
  );

  const activeAnomalyKeys = useMemo(() => new Set(filteredAnomalies.map(a => `${a.oid}::${a.type}`)), [filteredAnomalies]);

  const cnt = useMemo(() => {
    const c: Record<string, number> = { HIGH: 0, MED: 0, LOW: 0, WARN: 0 };
    filteredAnomalies.forEach(a => { c[a.severity] = (c[a.severity] || 0) + 1; });
    return c;
  }, [filteredAnomalies]);

  const anomaliesByArea = useMemo(() => {
    const groups: Record<string, typeof filteredAnomalies> = {};
    filteredAnomalies.forEach(a => {
      const area = a.area || '未知';
      if (!groups[area]) groups[area] = [];
      groups[area].push(a);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filteredAnomalies]);

  const types = ['分拣超时', '配送超时', '压单'];

  return (
    <div className="space-y-4">
      {/* Collection Time */}
      <Card className="dark:bg-[#1c1c1e]">
        <CardContent className="px-4 py-3 flex items-center gap-2 text-[13px] text-[#86868b] dark:text-[#98989d]">
          <span className="h-2 w-2 rounded-full bg-[#34c759]" />
          <span>采集时间: {formatTime(data.updated_at)}</span>
        </CardContent>
      </Card>

      {/* Severity Summary */}
      <div className="flex flex-wrap gap-1.5">
        {cnt.HIGH > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ff3b30]/10 dark:bg-[#ff453a]/15 text-[#ff3b30] dark:text-[#ff453a]">严重: {cnt.HIGH}</span>}
        {cnt.MED > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ff9500]/10 dark:bg-[#ff9f0a]/15 text-[#ff9500] dark:text-[#ff9f0a]">中等: {cnt.MED}</span>}
        {cnt.LOW > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#ffcc00]/10 dark:bg-[#ffd60a]/15 text-[#9a6700] dark:text-[#ffd60a]">轻微: {cnt.LOW}</span>}
        {cnt.WARN > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#86868b]/10 dark:bg-[#98989d]/15 text-[#86868b] dark:text-[#98989d]">警告: {cnt.WARN}</span>}
      </div>

      {/* Shop Filter */}
      {shopNames.length > 1 && (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-[#86868b] dark:text-[#98989d]">按店铺筛选:</span>
          <Select value={selectedShop} onValueChange={(v: string | null) => v && setSelectedShop(v)}>
            <SelectTrigger className="w-[180px] h-8 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              <SelectItem value="__all__">全部</SelectItem>
              {shopNames.map(shop => (
                <SelectItem key={shop} value={shop}>{shop}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Anomalies by Area */}
      {anomaliesByArea.length > 0 && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardHeader className="pb-0 px-3 sm:px-6">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">
              按区域查看 · {filteredAnomalies.length} 单
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            {anomaliesByArea.map(([area, items]) => (
              <div key={area}>
                <div className="text-[12px] font-medium text-[#86868b] dark:text-[#98989d] mb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ff3b30]" />
                  {area}（{items.length}）
                </div>
                {/* Mobile: card list */}
                <div className="sm:hidden space-y-2">
                  {items.map((a, i) => (
                    <button key={i} onClick={() => setSelectedAnomaly(a)} className="w-full text-left p-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl active:bg-[#ebebed] dark:active:bg-[#3a3a3c] transition-colors min-h-[56px]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="min-w-0 flex-1 mr-2">
                          <span className="font-medium text-[14px] text-[#1d1d1f] dark:text-white truncate block">{a.shop}</span>
                          {a.detail && (
                            <span className="text-[11px] text-[#86868b] dark:text-[#98989d] block truncate">{a.detail}</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                            {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_BADGE_CLASSES[a.type] || 'bg-[#86868b]/10 text-[#86868b] dark:bg-[#98989d]/15 dark:text-[#98989d]'}`}>
                            {a.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#86868b] dark:text-[#98989d]">
                        <span className="text-[#ff3b30] dark:text-[#ff453a] font-medium">{a.elapsed_label || a.type} {a.elapsed_min}分钟</span>
                        <span>扫码 {a.scan_time || '--'}</span>
                        {a.rider && <span>骑手 {a.rider}</span>}
                        {a.dorm && <span>宿舍 {a.dorm}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-[#0071e3] dark:text-[#0a84ff] font-mono cursor-pointer active:underline" onClick={(e) => { e.stopPropagation(); copyToClipboard(a.oid); }}>
                          {a.oid}
                        </span>
                        <span className="text-[10px] text-[#c7c7cc] dark:text-[#636366]">点击复制</span>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>严重度</TableHead>
                        <TableHead>耗时</TableHead>
                        <TableHead>扫码时间</TableHead>
                        <TableHead>订单号</TableHead>
                        <TableHead>店名</TableHead>
                        <TableHead>宿舍</TableHead>
                        <TableHead>骑手</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((a, i) => (
                        <TableRow key={i} className="cursor-pointer" onClick={() => setSelectedAnomaly(a)}>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                              {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                            </span>
                          </TableCell>
                          <TableCell className="text-[13px]">
                            <span className="text-[#ff3b30] dark:text-[#ff453a] font-medium">{a.elapsed_label || a.type}</span>
                            <span className="ml-1">{a.elapsed_min}分钟</span>
                          </TableCell>
                          <TableCell className="text-[13px] font-mono">{a.scan_time || '--'}</TableCell>
                          <TableCell className="text-[13px]">
                            <span
                              className="text-[#0071e3] dark:text-[#0a84ff] font-mono cursor-pointer hover:underline"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(a.oid); }}
                              title="点击复制"
                            >
                              {a.oid}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                          <TableCell className="text-[13px]">{a.dorm || '--'}</TableCell>
                          <TableCell className="text-[13px]">{a.rider || '--'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grouped Display */}
      {types.map(type => {
        const items = filteredAnomalies.filter(a => a.type === type);
        if (items.length === 0) return null;
        return (
          <Card key={type} className={cn('overflow-hidden dark:bg-[#1c1c1e]', typeColors[type])}>
            <CardHeader className="pb-1">
              <CardTitle className={cn("text-[13px] font-medium flex items-center gap-2", typeTextColors[type] || 'text-[#1d1d1f] dark:text-white')}>
                {type}
                <Badge variant="secondary" className="text-[11px]">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-2">
                {items.map((a, i) => (
                  <div key={i} className="p-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl active:bg-[#ebebed] dark:active:bg-[#3a3a3c] transition-colors min-h-[56px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[14px] text-[#1d1d1f] dark:text-white truncate max-w-[55%]">{a.shop}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                        {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#86868b] dark:text-[#98989d]">
                      <span>{a.rider || '--'}</span>
                      <span>{a.elapsed_min}分钟/{a.threshold}分钟</span>
                      <span>{a.dorm || '--'}</span>
                      {a.baseline != null && <span>基线{a.baseline} 斜率{a.slope != null ? (a.slope >= 0 ? '+' : '') + a.slope : '--'}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block max-h-[500px] overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>严重度</TableHead>
                    <TableHead>配送单号</TableHead>
                    <TableHead>订单号</TableHead>
                    <TableHead>店名</TableHead>
                    <TableHead>宿舍</TableHead>
                    <TableHead>扫码时间</TableHead>
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                          {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-[13px]">{a.delivery_seq || '--'}</TableCell>
                      <TableCell className="text-[13px]">
                        <span
                          className="text-[#0071e3] dark:text-[#0a84ff] font-mono cursor-pointer hover:underline"
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(a.oid); }}
                          title="点击复制"
                        >
                          {a.oid}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                      <TableCell className="text-[13px]">{a.dorm || '--'}</TableCell>
                      <TableCell className="text-[13px]">{a.scan_time || '--'}</TableCell>
                      <TableCell className="text-[13px]">{a.elapsed_min}分钟</TableCell>
                      <TableCell className="text-[13px]">{a.threshold}分钟</TableCell>
                      <TableCell className="text-[13px]">{a.rider || '--'}</TableCell>
                      <TableCell className="text-xs text-[#86868b] dark:text-[#98989d]">
                        {a.baseline != null ? `基线${a.baseline} 斜率${a.slope != null ? (a.slope >= 0 ? '+' : '') + a.slope : '--'}` : '--'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Today's History */}
      {filteredAllAnomalies.length > filteredAnomalies.length && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">
              今日历史（共 {filteredAllAnomalies.length} 条，已去重 {filteredAllAnomalies.length - filteredAnomalies.length} 条）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile: card list */}
            <div className="sm:hidden space-y-2">
              {filteredAllAnomalies.map((a) => (
                <div key={`${a.oid}-${a.type}`} className={cn('p-3 bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-xl min-h-[56px]', !activeAnomalyKeys.has(`${a.oid}::${a.type}`) && 'opacity-50')}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[14px] text-[#1d1d1f] dark:text-white truncate max-w-[55%]">{a.shop}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>
                      {SEVERITY_LABEL_MAP[a.severity] || a.severity}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[#86868b] dark:text-[#98989d]">
                    <span>{a.type}</span>
                    <span>{a.rider || '--'}</span>
                    <span>{a.elapsed_min}分钟</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block max-h-[500px] overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>严重度</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>店名</TableHead>
                  <TableHead>宿舍</TableHead>
                  <TableHead>耗时</TableHead>
                  <TableHead>骑手</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllAnomalies.map((a) => (
                  <TableRow key={`${a.oid}-${a.type}`} className={activeAnomalyKeys.has(`${a.oid}::${a.type}`) ? '' : 'opacity-50'}>
                    <TableCell><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_BADGE_CLASSES[a.severity] || SEVERITY_BADGE_CLASSES.WARN}`}>{SEVERITY_LABEL_MAP[a.severity] || a.severity}</span></TableCell>
                    <TableCell>{a.type}</TableCell>
                    <TableCell>
                      <span
                        className="text-[#0071e3] dark:text-[#0a84ff] font-mono cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(a.oid); }}
                        title="点击复制"
                      >
                        {a.oid}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-[13px]">{a.shop}</TableCell>
                    <TableCell>{a.dorm || '--'}</TableCell>
                    <TableCell>{a.elapsed_min}分钟</TableCell>
                    <TableCell>{a.rider || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAnomalies.length === 0 && filteredAllAnomalies.length === 0 && (
        <Card className="dark:bg-[#1c1c1e]">
          <CardContent className="p-10 text-center">
            <div className="text-[#86868b] dark:text-[#98989d] text-sm">暂无异常</div>
          </CardContent>
        </Card>
      )}

      {/* Anomaly Detail Dialog */}
      <Dialog open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <DialogContent className="max-w-lg rounded-2xl sm:rounded-2xl bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">
              {selectedAnomaly?.type || '异常详情'}
            </DialogTitle>
          </DialogHeader>
          {selectedAnomaly && (
            <div className="space-y-2 text-[13px]">
              {[
                { label: '类型', value: selectedAnomaly.type },
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
                <div key={label} className="flex items-center justify-between bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-lg px-3 py-2">
                  <span className="text-[#86868b] dark:text-[#98989d]">{label}</span>
                  <span className="font-medium text-[#1d1d1f] dark:text-white text-right ml-2">{value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
