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
  // Auth state - check localStorage for saved login
  const [authenticated, setAuthenticated] = useState(() => {
    return localStorage.getItem('aitemi_auth') === 'true';
  });
  const [loginKey, setLoginKey] = useState('');
  const [loginError, setLoginError] = useState('');

  const ACCESS_KEY = 'aitemi2024'; // 访问密钥

  const handleLogin = () => {
    if (loginKey === ACCESS_KEY) {
      localStorage.setItem('aitemi_auth', 'true');
      setAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('密钥错误');
    }
  };

  // Login page
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="20" width="32" height="22" rx="4" stroke="#0071e3" stroke-width="2.5"/>
              <path d="M16 20V14a8 8 0 0116 0v6" stroke="#0071e3" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="24" cy="32" r="3" fill="#0071e3"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[#1d1d1f] mb-1">艾特米监控平台</h1>
          <p className="text-sm text-[#86868b] mb-6">请输入访问密钥</p>
          <input
            type="password"
            value={loginKey}
            onChange={(e) => { setLoginKey(e.target.value); setLoginError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="访问密钥"
            className="w-full px-4 py-3 rounded-xl border border-[#e5e5ea] text-base outline-none focus:border-[#0071e3] transition-colors mb-3"
          />
          {loginError && <p className="text-[#ff3b30] text-sm mb-3">{loginError}</p>}
          <button onClick={handleLogin} className="w-full py-3 rounded-xl bg-[#0071e3] text-white font-medium text-base hover:bg-[#0077ed] transition-colors">
            进入
          </button>
        </div>
      </div>
    );
  }

  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('refresh_interval');
    return saved ? parseInt(saved, 10) : 300;
  });
  const { data, history, loading, error, triggerCollect } = useMonitorData(refreshInterval);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTab, setCurrentTab] = useState('overview');

  const handleRefresh = async () => {
    setRefreshing(true);
    await triggerCollect();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleIntervalChange = (val: number) => {
    setRefreshInterval(val);
    localStorage.setItem('refresh_interval', String(val));
  };

  const handleTimeRangeChange = (range: { start: string; end: string }) => {
    localStorage.setItem('scan_time_range', JSON.stringify(range));
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#0071e3] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
        <span className="text-sm text-[#86868b]">正在加载...</span>
      </div>
    );
  }

  const sessionOk = data?.session_valid ?? false;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Glassmorphism Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="max-w-6xl mx-auto flex h-[64px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">艾特米监控</h1>
            <Badge
              variant={sessionOk ? 'default' : 'destructive'}
              className={cn(
                'gap-1 text-[11px] px-2 py-0.5',
                sessionOk
                  ? 'bg-[#34c759]/10 text-[#34c759] hover:bg-[#34c759]/15'
                  : 'bg-[#ff3b30]/10 text-[#ff3b30] hover:bg-[#ff3b30]/15'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', sessionOk ? 'bg-[#34c759]' : 'bg-[#ff3b30]')} />
              {sessionOk ? '在线' : 'Session 过期'}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-[#86868b]">
            <span className="hidden sm:inline">{relativeTime(data?.updated_at || '')}更新</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04]"
            >
              <RefreshCw className={cn('h-[18px] w-[18px]', refreshing && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04]"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <Alert variant="destructive" className="rounded-2xl border-none bg-[#ff3b30]/8 text-[#ff3b30]">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-[13px]">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {!sessionOk && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <Alert variant="destructive" className="rounded-2xl border-none bg-[#ff3b30]/8 text-[#ff3b30]">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-[13px]">Session 已过期，请更新 Cookie</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-4">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-5">
          <TabsList className="w-full sm:w-auto flex overflow-x-auto no-scrollbar">
            <TabsTrigger value="overview" className="gap-1.5 text-[13px] px-3">
              <LayoutDashboard className="h-3.5 w-3.5" />总览
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-1.5 text-[13px] px-3">
              <AlertTriangle className="h-3.5 w-3.5" />异常
            </TabsTrigger>
            <TabsTrigger value="riders" className="gap-1.5 text-[13px] px-3">
              <Users className="h-3.5 w-3.5" />骑手
            </TabsTrigger>
            <TabsTrigger value="skipscan" className="gap-1.5 text-[13px] px-3">
              <Clock className="h-3.5 w-3.5" />跳扫
            </TabsTrigger>
            <TabsTrigger value="competitor" className="gap-1.5 text-[13px] px-3">
              <BarChart3 className="h-3.5 w-3.5" />竞品
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-[13px] px-3">
              <TrendingUp className="h-3.5 w-3.5" />历史
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewPanel data={data} history={history} formatTime={formatTime} onTabChange={setCurrentTab} />
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
        scanTimeRange={data?.config?.scan_time_range}
        onTimeRangeChange={handleTimeRangeChange}
      />
    </div>
  );
}
