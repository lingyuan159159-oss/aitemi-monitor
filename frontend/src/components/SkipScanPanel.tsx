import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MonitorData } from '@/lib/types';

interface Props { data: MonitorData | null; }

const severityColors: Record<string, string> = {
  HIGH: 'bg-[#ff3b30]/10 text-[#ff3b30]',
  MED: 'bg-[#ff9500]/10 text-[#ff9500]',
  LOW: 'bg-[#ffcc00]/10 text-[#9a6700]',
  WARN: 'bg-[#86868b]/10 text-[#86868b]',
};
const severityLabels: Record<string, string> = { HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告' };

export function SkipScanPanel({ data }: Props) {
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  if (!data) return null;
  const { skip_scans: scans, skip_scan_riders: riders } = data;
  const threshold = data.config?.skip_scan_threshold || 60;

  // 获取选中骑手的订单
  const selectedOrders = selectedRider ? scans.filter(s => s.rider === selectedRider) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="px-4 py-3">
          <p className="text-[13px] text-[#86868b]">投餐到送达间隔 &lt; {threshold} 秒视为疑似跳扫码</p>
        </CardContent>
      </Card>

      {/* Rider Summary */}
      {riders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {riders.map(r => (
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
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">全部记录（阈值: {threshold}秒）</CardTitle>
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
                      <Badge className={severityColors[s.severity] || 'bg-[#86868b]/10 text-[#86868b]'}>{severityLabels[s.severity] || s.severity}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-[13px]">{s.rider}</TableCell>
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
            <DialogTitle>{selectedRider} - 跳扫码记录</DialogTitle>
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
                    <TableCell><Badge className={severityColors[s.severity] || severityColors.LOW}>{severityLabels[s.severity] || s.severity}</Badge></TableCell>
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
