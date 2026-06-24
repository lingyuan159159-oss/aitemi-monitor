import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { MonitorData } from '@/lib/types';
import { Store, TrendingUp, Users, BarChart3 } from 'lucide-react';

interface Props { data: MonitorData | null; }

function MetricCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | string; color: string; }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function CompetitorPanel({ data }: Props) {
  if (!data || !data.competitor || !data.competitor.stores) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">暂无竞品数据</CardContent></Card>;
  }
  const comp = data.competitor;
  const top15 = comp.stores.slice(0, 15);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">数据日期: {comp.date}</CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={TrendingUp} label="当日销量" value={comp.total_daily} color="bg-blue-500/10 text-blue-500" />
        <MetricCard icon={BarChart3} label="累计销量" value={comp.total_cumul.toLocaleString()} color="bg-green-500/10 text-green-500" />
        <MetricCard icon={Users} label="活跃店铺" value={comp.active_stores} color="bg-green-500/10 text-green-500" />
        <MetricCard icon={Store} label="总店铺数" value={comp.total_stores} color="bg-muted text-muted-foreground" />
      </div>

      {/* TOP 15 横向柱状图 */}
      <Card>
        <CardHeader><CardTitle className="text-sm">TOP 15</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top15} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
              <Tooltip />
              <Bar dataKey="daily" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 全部排名 */}
      <Card>
        <CardHeader><CardTitle className="text-sm">全部排名</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>店铺</TableHead>
                <TableHead>当日</TableHead>
                <TableHead>累计</TableHead>
                <TableHead>昨日累计</TableHead>
                <TableHead>评分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comp.stores.map((s, i) => (
                <TableRow key={s.id} className={s.daily === 0 ? 'opacity-40' : ''}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="font-bold">{s.daily}</TableCell>
                  <TableCell>{s.total.toLocaleString()}</TableCell>
                  <TableCell>{s.yesterday_total.toLocaleString()}</TableCell>
                  <TableCell>{s.score || '--'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
