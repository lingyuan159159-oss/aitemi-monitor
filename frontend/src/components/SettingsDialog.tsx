import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshInterval: number;
  onIntervalChange: (val: number) => void;
  scanIntervals?: Record<string, number>;
  scanTimeRange?: { start: string; end: string };
  onTimeRangeChange?: (range: { start: string; end: string }) => void;
  thresholds?: Record<string, number>;
  onThresholdsChange?: (t: Record<string, number>) => void;
}

const intervalLabels: Record<string, string> = {
  sort_timeout: '分拣超时',
  deliver_timeout: '配送超时',
  backlog: '压单',
  rider_stats: '骑手统计',
  skip_scan: '跳扫码检测',
  competitor: '竞品监控',
};

export function SettingsDialog({ open, onOpenChange, refreshInterval, onIntervalChange, scanIntervals, scanTimeRange, onTimeRangeChange, thresholds, onThresholdsChange }: Props) {
  const [localIntervals, setLocalIntervals] = useState<Record<string, number>>({});
  const [timeRange, setTimeRange] = useState({ start: '11:00', end: '23:00' });
  const [localThresholds, setLocalThresholds] = useState<Record<string, number>>({
    sort_timeout: 20, deliver_timeout: 15, backlog: 30, skip_scan: 60,
  });

  useEffect(() => {
    if (scanIntervals) setLocalIntervals({ ...scanIntervals });
  }, [scanIntervals]);

  useEffect(() => {
    if (scanTimeRange) setTimeRange({ ...scanTimeRange });
  }, [scanTimeRange]);

  useEffect(() => {
    if (thresholds) setLocalThresholds({ ...thresholds });
  }, [thresholds]);

  const handleSave = () => {
    localStorage.setItem('scan_intervals', JSON.stringify(localIntervals));
    localStorage.setItem('thresholds', JSON.stringify(localThresholds));
    if (onTimeRangeChange) onTimeRangeChange(timeRange);
    if (onThresholdsChange) onThresholdsChange(localThresholds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-white/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f]">设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="text-xs text-[#86868b] font-medium uppercase tracking-wider">页面刷新</Label>
            <Select value={String(refreshInterval)} onValueChange={(v: string | null) => v && onIntervalChange(parseInt(v, 10))}>
              <SelectTrigger className="mt-2 rounded-xl border-black/[0.06] bg-[#f5f5f7] h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="60">1 分钟</SelectItem>
                <SelectItem value="120">2 分钟</SelectItem>
                <SelectItem value="300">5 分钟</SelectItem>
                <SelectItem value="600">10 分钟</SelectItem>
                <SelectItem value="1800">30 分钟</SelectItem>
                <SelectItem value="0">关闭</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-black/[0.06]" />

          <div>
            <Label className="text-xs text-[#86868b] font-medium uppercase tracking-wider">采集时间范围</Label>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-[#1d1d1f]">开始时间</Label>
                <Input
                  type="time"
                  value={timeRange.start}
                  className="h-9 text-sm rounded-xl border-black/[0.06] bg-[#f5f5f7]"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <span className="text-[#86868b] mt-5">至</span>
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-[#1d1d1f]">结束时间</Label>
                <Input
                  type="time"
                  value={timeRange.end}
                  className="h-9 text-sm rounded-xl border-black/[0.06] bg-[#f5f5f7]"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-[#86868b] mt-1.5">超出时间范围将自动暂停采集</p>
          </div>

          <Separator className="bg-black/[0.06]" />

          <div>
            <Label className="text-xs text-[#86868b] font-medium uppercase tracking-wider">采集间隔（分钟）</Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {Object.entries(intervalLabels).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-[#1d1d1f]">{label}</Label>
                  <Input
                    type="number"
                    value={localIntervals[key] || 5}
                    min={1}
                    className="h-9 text-sm rounded-xl border-black/[0.06] bg-[#f5f5f7]"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalIntervals(prev => ({ ...prev, [key]: parseInt(e.target.value, 10) || 5 }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <Separator className="bg-black/[0.06]" />

          <div>
            <Label className="text-xs text-[#86868b] font-medium uppercase tracking-wider">超时阈值（分钟）</Label>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs text-[#1d1d1f]">分拣超时</Label>
                <Input
                  type="number"
                  value={localThresholds.sort_timeout || 20}
                  min={1}
                  className="h-9 text-sm rounded-xl border-black/[0.06] bg-[#f5f5f7]"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalThresholds(prev => ({ ...prev, sort_timeout: parseInt(e.target.value, 10) || 20 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#1d1d1f]">配送超时</Label>
                <Input
                  type="number"
                  value={localThresholds.deliver_timeout || 15}
                  min={1}
                  className="h-9 text-sm rounded-xl border-black/[0.06] bg-[#f5f5f7]"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalThresholds(prev => ({ ...prev, deliver_timeout: parseInt(e.target.value, 10) || 15 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#1d1d1f]">压单</Label>
                <Input
                  type="number"
                  value={localThresholds.backlog || 30}
                  min={1}
                  className="h-9 text-sm rounded-xl border-black/[0.06] bg-[#f5f5f7]"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalThresholds(prev => ({ ...prev, backlog: parseInt(e.target.value, 10) || 30 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#1d1d1f]">跳扫码（秒）</Label>
                <Input
                  type="number"
                  value={localThresholds.skip_scan || 60}
                  min={1}
                  className="h-9 text-sm rounded-xl border-black/[0.06] bg-[#f5f5f7]"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalThresholds(prev => ({ ...prev, skip_scan: parseInt(e.target.value, 10) || 60 }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-[#86868b] mt-1.5">超过阈值即判定为异常</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-black/[0.06] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-black/[0.04]"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            className="rounded-xl bg-[#0071e3] text-white hover:bg-[#0077ed]"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
