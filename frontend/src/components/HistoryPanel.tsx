import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { HistoryEntry } from '@/lib/types';

interface Props { history: HistoryEntry[]; }

export function HistoryPanel({ history }: Props) {
  if (!history || history.length < 2) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="text-[#86868b] text-sm">暂无历史数据，等待采集...</div>
        </CardContent>
      </Card>
    );
  }

  const chartData = history.map(h => ({
    time: h.time.split('T')[1] || h.time,
    orders: h.orders,
    delivering: h.delivering,
    anomalies: h.anomalies,
    skip_scans: h.skip_scans,
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

  const legendStyle = { fontSize: '11px', color: '#86868b' };

  // 生成总结文字
  const latest = chartData[chartData.length - 1];
  const earliest = chartData[0];
  const maxOrders = Math.max(...chartData.map(d => d.orders));
  const maxAnomalies = Math.max(...chartData.map(d => d.anomalies));
  const totalSkipScans = chartData.reduce((sum, d) => sum + d.skip_scans, 0);
  const maxSkipScans = Math.max(...chartData.map(d => d.skip_scans));

  const orderSummary = latest
    ? `当前订单 ${latest.orders} 单，配送中 ${latest.delivering} 单，24小时内峰值 ${maxOrders} 单。${latest.orders > earliest.orders ? '订单量整体上升' : latest.orders < earliest.orders ? '订单量整体下降' : '订单量基本持平'}。`
    : '暂无数据';

  const anomalySummary = latest
    ? `当前异常 ${latest.anomalies} 单，24小时内峰值 ${maxAnomalies} 单。${latest.anomalies === 0 ? '目前无异常' : latest.anomalies > (earliest.anomalies || 0) ? '异常数量上升，需关注' : '异常数量可控'}。`
    : '暂无数据';

  const skipScanSummary = latest
    ? `当前跳扫码 ${latest.skip_scans} 单，24小时内累计 ${totalSkipScans} 单，峰值 ${maxSkipScans} 单。${latest.skip_scans === 0 ? '目前无跳扫码' : latest.skip_scans > 2 ? '跳扫码偏多，需排查骑手' : '跳扫码数量较少'}。`
    : '暂无数据';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">订单量 (24小时)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#86868b' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={legendStyle} />
                <Line type="monotone" dataKey="orders" stroke="#0071e3" strokeWidth={2} dot={false} name="总订单" />
                <Line type="monotone" dataKey="delivering" stroke="#34c759" strokeWidth={2} dot={false} name="配送中" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[12px] text-[#86868b] mt-2 px-1 leading-relaxed">{orderSummary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">异常数 (24小时)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#86868b' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Legend wrapperStyle={legendStyle} />
                <Line type="monotone" dataKey="anomalies" stroke="#ff3b30" strokeWidth={2} dot={false} name="异常" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[12px] text-[#86868b] mt-2 px-1 leading-relaxed">{anomalySummary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">跳扫码 (24小时)</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#86868b' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Line type="monotone" dataKey="skip_scans" stroke="#af52de" strokeWidth={2} dot={false} name="跳扫码" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[12px] text-[#86868b] mt-2 px-1 leading-relaxed">{skipScanSummary}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
