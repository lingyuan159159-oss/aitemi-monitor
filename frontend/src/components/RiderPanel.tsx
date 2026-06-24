import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MonitorData } from '@/lib/types';

interface Props { data: MonitorData | null; }

export function RiderPanel({ data }: Props) {
  if (!data || data.riders.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">暂无骑手数据</CardContent></Card>;
  }

  const byArea: Record<string, typeof data.riders> = {};
  data.riders.forEach(r => {
    if (!byArea[r.area]) byArea[r.area] = [];
    byArea[r.area].push(r);
  });

  return (
    <div className="space-y-4">
      {Object.entries(byArea).map(([area, riders]) => (
        <Card key={area}>
          <CardHeader><CardTitle className="text-sm">{area}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {riders.map(r => (
                <div key={r.name} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-24 font-semibold text-sm">{r.name}</div>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    {[
                      { label: '分拣', data: r.sort },
                      { label: '停留', data: r.stay },
                      { label: '配送', data: r.deliver },
                    ].map(d => (
                      <div key={d.label} className="text-center p-2 rounded-md bg-background">
                        <div className="text-xs text-muted-foreground">{d.label}</div>
                        <div className={cn('text-lg font-bold', d.data.rate > 20 && 'text-red-500')}>
                          {d.data.rate}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.data.overtime}/{d.data.total} 超时 | 均{d.data.avg}分钟
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
