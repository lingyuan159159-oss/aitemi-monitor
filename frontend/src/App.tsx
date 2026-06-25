import { useState, useEffect } from 'react';
import { useMonitorData } from '@/hooks/useMonitorData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  LayoutDashboard, AlertTriangle, Users, Camera,
  MoreHorizontal, TrendingUp, BarChart3, Settings,
  Loader2, RefreshCw, ChevronRight, Activity, FileText,
  Sun, Moon
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

  // NOTE: Hooks 必须在条件 return 之前调用，否则违反 React Hooks 规则
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('refresh_interval');
    return saved ? parseInt(saved, 10) : 300;
  });
  const { data, history, loading, error, triggerCollect } = useMonitorData(authenticated ? refreshInterval : 0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTab, setCurrentTab] = useState('overview');
  const [thresholds, setThresholds] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('thresholds');
      return saved ? JSON.parse(saved) : { sort_timeout: 20, deliver_timeout: 15, backlog: 30, skip_scan: 60 };
    } catch {
      return { sort_timeout: 20, deliver_timeout: 15, backlog: 30, skip_scan: 60 };
    }
  });

  // 告警弹窗
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; level: 'danger' | 'warning' }>({ title: '', message: '', level: 'warning' });
  const [aiReportOpen, setAiReportOpen] = useState(false);

  // 暗色模式: 'system' | 'dark' | 'light'
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (darkMode === 'dark') {
      root.classList.add('dark');
    } else if (darkMode === 'light') {
      root.classList.add('light');
    }
    localStorage.setItem('theme', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'system' : 'dark');
  };

  // 检测异常状态，自动弹窗
  useEffect(() => {
    if (!data || !authenticated) return;
    const sessionOk = data.session_valid ?? false;
    const score = data.health_score ?? 100;
    const criticalAnomalies = data.anomalies?.filter(a => a.severity === '严重').length ?? 0;

    if (!sessionOk) {
      setAlertInfo({ title: '🚨 Session 过期', message: '艾特米后台 Session 已失效，数据停止采集。请重新登录后台更新 Cookie。', level: 'danger' });
      setAlertOpen(true);
    } else if (score < 40) {
      setAlertInfo({ title: '🚨 健康评分极低', message: `当前评分 ${score} 分，有 ${criticalAnomalies} 条严重异常，需要立即处理！`, level: 'danger' });
      setAlertOpen(true);
    } else if (score < 60) {
      setAlertInfo({ title: '⚠️ 健康评分偏低', message: `当前评分 ${score} 分，有 ${data.summary?.anomaly_count ?? 0} 条异常，请关注。`, level: 'warning' });
      setAlertOpen(true);
    }
  }, [data?.session_valid, data?.health_score, data?.anomalies?.length, authenticated]);

  const ACCESS_KEY = 'aitemi2026'; // TODO: 移到后端验证

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
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm p-8 w-full max-w-sm text-center">
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
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000]">
      {/* Glassmorphism Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-xl backdrop-saturate-150">
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
            <span className="w-px h-4 bg-black/[0.08] mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04]"
              title={darkMode === 'dark' ? '暗色' : darkMode === 'light' ? '亮色' : '跟随系统'}
            >
              {darkMode === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
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
      <main className="max-w-6xl mx-auto px-4 py-4 pb-24">
        {currentTab !== 'overview' && currentTab !== 'more' && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04] -ml-1 mb-1"
            onClick={() => setCurrentTab('overview')}
          >
            返回总览
          </Button>
        )}

        {currentTab === 'overview' && (
          <OverviewPanel data={data} history={history} formatTime={formatTime} onTabChange={setCurrentTab} />
        )}
        {currentTab === 'anomalies' && (
          <AnomalyPanel data={data} formatTime={formatTime} />
        )}
        {currentTab === 'riders' && (
          <RiderPanel data={data} />
        )}
        {currentTab === 'skipscan' && (
          <SkipScanPanel data={data} />
        )}
        {currentTab === 'competitor' && (
          <CompetitorPanel data={data} />
        )}
        {currentTab === 'history' && (
          <HistoryPanel history={history} />
        )}

        {/* More Page */}
        {currentTab === 'more' && (
          <div className="space-y-3">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">更多</h2>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {[
                { icon: BarChart3, label: '竞品监控', tab: 'competitor', color: 'text-[#0071e3]' },
                { icon: TrendingUp, label: '历史曲线', tab: 'history', color: 'text-[#34c759]' },
                { icon: FileText, label: 'AI 日报', action: 'aireport', color: 'text-[#af52de]' },
                { icon: Settings, label: '设置', action: 'settings', color: 'text-[#86868b]' },
                { icon: Activity, label: '系统状态', tab: 'overview', color: 'text-[#ff9500]' },
              ].map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.action === 'settings') {
                      setSettingsOpen(true);
                    } else if (item.action === 'aireport') {
                      setAiReportOpen(true);
                    } else {
                      setCurrentTab(item.tab!);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-black/[0.03] transition-colors',
                    i < 3 && 'border-b border-[#f2f2f7]'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', item.color)} />
                  <span className="text-[15px] text-[#1d1d1f] flex-1">{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-[#c7c7cc]" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/[0.06] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-xl backdrop-saturate-150 safe-area-bottom">
        <div className="max-w-6xl mx-auto flex h-[60px]">
          {[
            { id: 'overview', label: '总览', icon: LayoutDashboard, emoji: '🏠' },
            { id: 'anomalies', label: '异常', icon: AlertTriangle, emoji: '⚠️', badge: data?.summary?.anomaly_count },
            { id: 'riders', label: '骑手', icon: Users, emoji: '👤' },
            { id: 'skipscan', label: '跳扫', icon: Camera, emoji: '📷', badge: data?.summary?.skip_scan_count, badgeColor: 'bg-[#ff9500]' },
            { id: 'more', label: '更多', icon: MoreHorizontal, emoji: '⋯' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative tap-highlight-transparent"
            >
              <div className="relative">
                <tab.icon
                  className={cn(
                    'h-[22px] w-[22px] transition-colors',
                    currentTab === tab.id ? 'text-[#0071e3]' : 'text-[#86868b]'
                  )}
                />
                {tab.badge != null && tab.badge > 0 && (
                  <span className={cn(
                    'absolute -top-1.5 -right-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-white text-[10px] font-medium px-1',
                    tab.badgeColor || 'bg-[#ff3b30]'
                  )}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-[11px] transition-colors',
                currentTab === tab.id ? 'text-[#0071e3] font-medium' : 'text-[#86868b]'
              )}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        refreshInterval={refreshInterval}
        onIntervalChange={handleIntervalChange}
        scanIntervals={data?.config?.scan_intervals}
        scanTimeRange={data?.config?.scan_time_range}
        onTimeRangeChange={handleTimeRangeChange}
        thresholds={thresholds}
        onThresholdsChange={setThresholds}
      />

      {/* Alert Dialog - Session / Health Score */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="max-w-sm rounded-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className={cn('text-[17px] font-semibold', alertInfo.level === 'danger' ? 'text-[#ff3b30]' : 'text-[#ff9500]')}>
              {alertInfo.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-[#1d1d1f] leading-relaxed">{alertInfo.message}</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setAlertOpen(false)} className="flex-1 rounded-xl">
              知道了
            </Button>
            {!data?.session_valid && (
              <Button onClick={() => { setAlertOpen(false); }} className="flex-1 rounded-xl bg-[#ff3b30] hover:bg-[#ff3b30]/90 text-white">
                去更新
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Report Dialog */}
      <Dialog open={aiReportOpen} onOpenChange={setAiReportOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white/95 backdrop-blur-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f]">📊 AI 日报</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-0">
            {data?.ai_report ? (
              <div className="text-[14px] text-[#1d1d1f] whitespace-pre-wrap leading-relaxed">{data.ai_report}</div>
            ) : (
              <div className="text-center py-8">
                <div className="text-[#86868b] text-sm">今日日报尚未生成</div>
                <div className="text-[#c7c7cc] text-xs mt-1">每天 22:30 自动生成</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
