import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MonitorData } from '@/lib/types';

interface Props { data: MonitorData | null; }

export function RiderPanel({ data }: Props) {
  if (!data || data.riders.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <div className="text-[#86868b] text-sm">暂无骑手数据</div>
        </CardContent>
      </Card>
    );
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
          <CardHeader className="pb-1">
            <CardTitle className="text-[13px] font-medium text-[#1d1d1f]">{area}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {riders.map(r => (
                <div key={r.name} className="flex items-center gap-4 p-3.5 rounded-2xl bg-[#f5f5f7]">
                  <div className="w-24 font-semibold text-[13px] text-[#1d1d1f]">{r.name}</div>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    {[
                      { label: '分拣', data: r.sort },
                      { label: '停留', data: r.stay },
                      { label: '配送', data: r.deliver },
                    ].map(d => (
                      <div key={d.label} className="text-center p-2.5 rounded-xl bg-white">
                        <div className="text-[11px] text-[#86868b] mb-0.5">{d.label}</div>
                        <div className={cn('text-lg font-semibold', d.data.rate > 20 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]')}>
                          {d.data.rate}%
                        </div>
                        <div className="text-[11px] text-[#86868b]">
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
