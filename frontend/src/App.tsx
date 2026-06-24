import { useState } from 'react';
import { useMonitorData } from '@/hooks/useMonitorData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LayoutDashboard, AlertTriangle, Users, Clock, BarChart3,
  TrendingUp, RefreshCw, Settings, Loader2
} from 'lucide-react';
import { OverviewPanel } from '@/components/OverviewPanel';
import { AnomalyPanel } from '@/components/AnomalyPanel';
import { RiderPanel } from '@/components/RiderPanel';
import { SkipScanPanel } from '@/components/SkipScanPanel';
import { CompetitorPanel } from '@/components/CompetitorPanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { SettingsDialog } from '@/components/SettingsDialog';
import { cn } from '@/lib/utils';

export default function App() {
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('refresh_interval');
    return saved ? parseInt(saved, 10) : 300;
  });
  const { data, history, loading, error, triggerCollect } = useMonitorData(refreshInterval);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await triggerCollect();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleIntervalChange = (val: number) => {
    setRefreshInterval(val);
    localStorage.setItem('refresh_interval', String(val));
  };

  const formatTime = (ts: string) => {
    if (!ts) return '--';
    try {
      const d = new Date(ts.includes('+') ? ts : ts + '+08:00');
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const relativeTime = (ts: string) => {
    if (!ts) return '--';
    try {
      const d = new Date(ts.includes('+') ? ts : ts + '+08:00');
      const diff = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return `${diff}秒前`;
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      return `${Math.floor(diff / 86400)}天前`;
    } catch { return '--'; }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sessionOk = data?.session_valid ?? false;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">艾特米监控</h1>
            <Badge variant={sessionOk ? 'default' : 'destructive'} className="gap-1">
              <span className={cn('h-2 w-2 rounded-full', sessionOk ? 'bg-green-500' : 'bg-red-500')} />
              {sessionOk ? '在线' : 'Session 过期'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{relativeTime(data?.updated_at || '')}更新</span>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <Alert variant="destructive" className="max-w-7xl mx-auto mt-3 mx-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!sessionOk && (
        <Alert variant="destructive" className="max-w-7xl mx-auto mt-3 mx-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Session 已过期，请更新 Cookie</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />总览
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" />异常
            </TabsTrigger>
            <TabsTrigger value="riders" className="gap-1.5">
              <Users className="h-4 w-4" />骑手
            </TabsTrigger>
            <TabsTrigger value="skipscan" className="gap-1.5">
              <Clock className="h-4 w-4" />跳扫
            </TabsTrigger>
            <TabsTrigger value="competitor" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />竞品
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />历史
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewPanel data={data} formatTime={formatTime} />
          </TabsContent>
          <TabsContent value="anomalies">
            <AnomalyPanel data={data} formatTime={formatTime} />
          </TabsContent>
          <TabsContent value="riders">
            <RiderPanel data={data} />
          </TabsContent>
          <TabsContent value="skipscan">
            <SkipScanPanel data={data} />
          </TabsContent>
          <TabsContent value="competitor">
            <CompetitorPanel data={data} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryPanel history={history} />
          </TabsContent>
        </Tabs>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        refreshInterval={refreshInterval}
        onIntervalChange={handleIntervalChange}
        scanIntervals={data?.config?.scan_intervals}
      />
    </div>
  );
}
