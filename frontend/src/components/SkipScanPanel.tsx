import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MonitorData } from '@/lib/types';
import { SEVERITY_BADGE_CLASSES, SEVERITY_LABEL_MAP } from '@/lib/constants';

interface Props { data: MonitorData | null; }

export function SkipScanPanel({ data }: Props) {
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  if (!data) return null;
  const { skip_scans: scans } = data;
  const threshold = data.config?.skip_scan_threshold || 60;

  // 直接从 skip_scans 计算每个骑手的数量，确保和表格一致
  const riderCountMap: Record<string, { count: number; high_risk: boolean }> = {};
  scans.forEach(s => {
    if (!s.rider) return;
    if (!riderCountMap[s.rider]) riderCountMap[s.rider] = { count: 0, high_risk: false };
    riderCountMap[s.rider].count++;
  });
  // 标记高风险（超过2单）
  Object.values(riderCountMap).forEach(r => { r.high_risk = r.count > 2; });
  const computedRiders = Object.entries(riderCountMap)
    .map(([name, info]) => ({ name, count: info.count, high_risk: info.high_risk }))
    .sort((a, b) => b.count - a.count);

  // 获取选中骑手的订单（直接从 scans 筛选）
  const selectedOrders = selectedRider ? scans.filter(s => s.rider === selectedRider) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="px-4 py-3">
          <p className="text-[13px] text-[#86868b]">投餐到送达间隔 &lt; {threshold} 秒视为疑似跳扫码</p>
        </CardContent>
      </Card>

      {/* Rider Summary */}
      {computedRiders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {computedRiders.map(r => (
            <Card key={r.name} className={cn('cursor-pointer hover:shadow-md transition-shadow', r.high_risk && 'border-l-[3px] border-l-[#ff3b30]')} onClick={() => setSelectedRider(r.name)}>
              <CardContent className="p-4">
                <div className="font-semibold text-[13px] text-[#1d1d1f]">{r.name}</div>
                <div className={cn('text-[26px] font-semibold tracking-tight', r.high_risk ? 'text-[#ff3b30]' : 'text-[#1d1d1f]')}>{r.count}</div>
                <div className="text-xs text-[#86868b]">{r.high_risk ? '高风险' : '次疑似'}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Table */}
      {scans.length > 0 ? (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">全部记录（共 {scans.length} 单，阈值: {threshold}秒）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>严重度</TableHead>
                  <TableHead>骑手</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>店名</TableHead>
                  <TableHead>投餐时间</TableHead>
                  <TableHead>送达时间</TableHead>
                  <TableHead>间隔</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge className={SEVERITY_BADGE_CLASSES[s.severity] || 'bg-[#86868b]/10 text-[#86868b]'}>{SEVERITY_LABEL_MAP[s.severity] || s.severity}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-[13px] cursor-pointer text-[#0071e3] hover:underline" onClick={() => setSelectedRider(s.rider)}>{s.rider}</TableCell>
                    <TableCell className="text-[13px]">{s.oid}</TableCell>
                    <TableCell className="text-[13px]">{s.shop}</TableCell>
                    <TableCell className="text-[13px]">{s.place_time}</TableCell>
                    <TableCell className="text-[13px]">{s.deliver_time}</TableCell>
                    <TableCell className="font-semibold text-[13px]">{s.gap_seconds}秒</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="text-[#86868b] text-sm">暂无跳扫码记录</div>
          </CardContent>
        </Card>
      )}

      {/* Rider Detail Dialog */}
      <Dialog open={!!selectedRider} onOpenChange={() => setSelectedRider(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRider} - 跳扫码记录（{selectedOrders.length}单）</DialogTitle>
          </DialogHeader>
          {selectedOrders.length > 0 ? (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>严重度</TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>店铺</TableHead>
                  <TableHead>投餐</TableHead>
                  <TableHead>送达</TableHead>
                  <TableHead>间隔</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedOrders.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell><Badge className={SEVERITY_BADGE_CLASSES[s.severity] || SEVERITY_BADGE_CLASSES.LOW}>{SEVERITY_LABEL_MAP[s.severity] || s.severity}</Badge></TableCell>
                    <TableCell>{s.oid}</TableCell>
                    <TableCell>{s.shop}</TableCell>
                    <TableCell>{s.place_time}</TableCell>
                    <TableCell>{s.deliver_time}</TableCell>
                    <TableCell className="font-semibold">{s.gap_seconds}秒</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="text-center text-[#86868b] py-8">暂无记录</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
