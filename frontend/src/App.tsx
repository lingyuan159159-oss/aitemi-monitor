import { useState, useEffect, useRef, useCallback } from 'react';
import { useMonitorData } from '@/hooks/useMonitorData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  LayoutDashboard, AlertTriangle, Users, Clock,
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
  const { data, history, compHistory, loading, error, warning, triggerCollect } = useMonitorData(authenticated ? refreshInterval : 0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTab, setCurrentTab] = useState('overview');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const showToast = (msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => setToast(s => ({ ...s, visible: false })), 2000);
  };
  // 告警弹窗
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; level: 'danger' | 'warning' }>({ title: '', message: '', level: 'warning' });
  const [aiReportOpen, setAiReportOpen] = useState(false);

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const PULL_THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (mainRef.current && mainRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  }, [isPulling]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      await triggerCollect();
      setRefreshing(false);
      showToast('已刷新');
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, refreshing, triggerCollect]);

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
      <div className="min-h-[100dvh] bg-[#f5f5f7] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-sm p-6 sm:p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="20" width="32" height="22" rx="4" stroke="#0071e3" strokeWidth="2.5"/>
              <path d="M16 20V14a8 8 0 0116 0v6" stroke="#0071e3" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="32" r="3" fill="#0071e3"/>
            </svg>
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#1d1d1f] dark:text-white mb-1">艾特米监控平台</h1>
          <p className="text-sm text-[#86868b] dark:text-[#98989d] mb-5 sm:mb-6">请输入访问密钥</p>
          <input
            type="password"
            value={loginKey}
            onChange={(e) => { setLoginKey(e.target.value); setLoginError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="访问密钥"
            className="w-full px-4 py-3.5 rounded-xl border border-[#e5e5ea] dark:border-[#38383a] bg-white dark:bg-[#2c2c2e] text-base outline-none focus:border-[#0071e3] transition-colors mb-3 min-h-[48px]"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {loginError && <p className="text-[#ff3b30] text-sm mb-3">{loginError}</p>}
          <button onClick={handleLogin} className="w-full py-3.5 rounded-xl bg-[#0071e3] text-white font-medium text-base active:bg-[#0056b3] transition-colors min-h-[48px]">
            进入
          </button>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await triggerCollect();
    setRefreshing(false);
    showToast('已刷新');
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
      <div className="min-h-[100dvh] bg-[#f5f5f7] dark:bg-[#0a0a0a]">
        <div className="sticky top-0 z-50 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-xl h-[64px]" />
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4">
          {/* Skeleton: health score */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-4 flex items-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-[#e5e5ea] dark:bg-[#38383a]" />
            <div className="flex-1 space-y-2"><div className="h-4 w-24 bg-[#e5e5ea] dark:bg-[#38383a] rounded" /><div className="h-3 w-32 bg-[#e5e5ea] dark:bg-[#38383a] rounded" /></div>
          </div>
          {/* Skeleton: metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-3 animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-[#e5e5ea] dark:bg-[#38383a] mb-2" />
                <div className="h-3 w-12 bg-[#e5e5ea] dark:bg-[#38383a] rounded mb-1" />
                <div className="h-5 w-16 bg-[#e5e5ea] dark:bg-[#38383a] rounded" />
              </div>
            ))}
          </div>
          {/* Skeleton: charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-4 animate-pulse">
                <div className="h-3 w-20 bg-[#e5e5ea] dark:bg-[#38383a] rounded mb-3" />
                <div className="h-40 bg-[#e5e5ea] dark:bg-[#38383a] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sessionOk = data?.session_valid ?? false;

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#0a0a0a]">
      {/* Glassmorphism Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="max-w-6xl mx-auto flex h-[64px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">艾特米监控</h1>
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
          <div className="flex items-center gap-1.5 text-[13px] text-[#86868b] dark:text-[#98989d]">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[#86868b] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
              title={`${relativeTime(data?.updated_at || '')}更新`}
            >
              {refreshing
                ? <Loader2 className="h-[18px] w-[18px] animate-spin text-[#0071e3]" />
                : <RefreshCw className="h-[18px] w-[18px]" />
              }
            </Button>
            <span className="w-px h-4 bg-black/[0.08] dark:bg-white/[0.08] mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              className="text-[#86868b] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
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
          <Alert variant="destructive" className="rounded-2xl border-none bg-[#ff3b30]/8 dark:bg-[#ff453a]/12 text-[#ff3b30] dark:text-[#ff453a]">
            <AlertTriangle className="h-4 w-4" />
            <div className="flex items-center justify-between flex-1 gap-2">
              <AlertDescription className="text-[13px]">{error}</AlertDescription>
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}
                className="text-[#ff3b30] dark:text-[#ff453a] hover:bg-[#ff3b30]/10 dark:hover:bg-[#ff453a]/15 text-[12px] shrink-0">
                重试
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {warning && !error && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <Alert className="rounded-2xl border-none bg-[#ff9500]/8 dark:bg-[#ff9f0a]/12 text-[#ff9500] dark:text-[#ff9f0a]">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-[13px]">{warning}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Collection Status Banner - 采集结束后显示 */}
      {data && (() => {
        const upd = new Date(data.updated_at.includes('+') ? data.updated_at : data.updated_at + '+08:00');
        const staleMinutes = Math.floor((Date.now() - upd.getTime()) / 60000);
        if (staleMinutes > 15) {
          return (
            <div className="max-w-6xl mx-auto px-4 pt-3">
              <Alert className="rounded-2xl border-none bg-[#ff9500]/8 dark:bg-[#ff9f0a]/12 text-[#ff9500] dark:text-[#ff9f0a]">
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-[13px]">
                  今日采集已暂停 · 上次采集 {staleMinutes > 60 ? `${Math.floor(staleMinutes / 60)}小时前` : `${staleMinutes}分钟前`}
                  {data.health_score != null && ` · 健康分 ${data.health_score}`}
                </AlertDescription>
              </Alert>
            </div>
          );
        }
        return null;
      })()}

      {!sessionOk && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <Alert variant="destructive" className="rounded-2xl border-none bg-[#ff3b30]/8 dark:bg-[#ff453a]/12 text-[#ff3b30] dark:text-[#ff453a]">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-[13px]">Session 已过期，请更新 Cookie</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Pull-to-refresh indicator */}
      <div className="flex justify-center overflow-hidden transition-all" style={{ height: pullDistance > 0 ? pullDistance : 0 }}>
        <div className="flex flex-col items-center justify-center gap-1">
          <RefreshCw className={cn('h-5 w-5 text-[#86868b] dark:text-[#98989d] transition-transform', pullDistance >= PULL_THRESHOLD && 'rotate-180 text-[#0071e3] dark:text-[#0a84ff]', refreshing && 'animate-spin')} />
          {pullDistance >= PULL_THRESHOLD && !refreshing && (
            <span className="text-[11px] text-[#0071e3] dark:text-[#0a84ff]">松开刷新</span>
          )}
          {refreshing && (
            <span className="text-[11px] text-[#86868b] dark:text-[#98989d]">刷新中...</span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main
        ref={mainRef}
        className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentTab !== 'overview' && currentTab !== 'more' && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] text-[#86868b] dark:text-[#98989d] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] -ml-1 mb-1"
            onClick={() => setCurrentTab('overview')}
          >
            返回总览
          </Button>
        )}

        {currentTab === 'overview' && (
          <div className="animate-[fadeIn_0.15s_ease]">
            <OverviewPanel data={data} history={history} formatTime={formatTime} onTabChange={setCurrentTab} onShowToast={showToast} />
          </div>
        )}
        {currentTab === 'anomalies' && (
          <div className="animate-[fadeIn_0.15s_ease]">
            <AnomalyPanel data={data} formatTime={formatTime} />
          </div>
        )}
        {currentTab === 'riders' && (
          <div className="animate-[fadeIn_0.15s_ease]">
            <RiderPanel data={data} />
          </div>
        )}
        {currentTab === 'skipscan' && (
          <div className="animate-[fadeIn_0.15s_ease]">
            <SkipScanPanel data={data} />
          </div>
        )}
        {currentTab === 'competitor' && (
          <div className="animate-[fadeIn_0.15s_ease]">
            <CompetitorPanel data={data} compHistory={compHistory} />
          </div>
        )}
        {currentTab === 'history' && (
          <div className="animate-[fadeIn_0.15s_ease]">
            <HistoryPanel history={history} />
          </div>
        )}

        {/* More Page */}
        {currentTab === 'more' && (
          <div className="space-y-3">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">更多</h2>
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden shadow-sm">
              {[
                { icon: AlertTriangle, label: '跳扫码检测', tab: 'skipscan', color: 'text-[#ff9500]', badge: data?.summary?.skip_scan_count },
                { icon: BarChart3, label: '竞品监控', tab: 'competitor', color: 'text-[#0071e3]' },
                { icon: TrendingUp, label: '历史曲线', tab: 'history', color: 'text-[#34c759]' },
                { icon: FileText, label: 'AI 日报', action: 'aireport', color: 'text-[#af52de]' },
                { icon: Settings, label: '设置', action: 'settings', color: 'text-[#86868b] dark:text-[#98989d]' },
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
                    'w-full flex items-center gap-3 px-4 py-3 sm:py-3.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.05] active:bg-black/[0.06] dark:active:bg-white/[0.08] transition-colors min-h-[48px]',
                    i < 4 && 'border-b border-[#f2f2f7] dark:border-[#38383a]'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', item.color)} />
                  <span className="text-[15px] text-[#1d1d1f] dark:text-white flex-1">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-[#ff9500] text-white text-[11px] font-medium px-1.5">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[#c7c7cc] dark:text-[#636366]" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/[0.06] dark:border-white/[0.06] bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl backdrop-saturate-150 safe-area-bottom">
        <div className="max-w-6xl mx-auto flex h-[56px] sm:h-[60px]">
          {[
            { id: 'overview', label: '总览', icon: LayoutDashboard },
            { id: 'anomalies', label: '异常', icon: AlertTriangle, badge: data?.summary?.anomaly_count },
            { id: 'riders', label: '骑手', icon: Users },
            { id: 'more', label: '更多', icon: MoreHorizontal, badge: (data?.summary?.skip_scan_count ?? 0) > 0 ? data?.summary?.skip_scan_count : undefined, badgeColor: 'bg-[#ff9500]' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative tap-highlight-transparent active:bg-black/[0.04] dark:active:bg-white/[0.06] transition-colors min-h-[56px]"
            >
              <div className="relative">
                <tab.icon
                  className={cn(
                    'h-[22px] w-[22px] transition-colors',
                    currentTab === tab.id ? 'text-[#0071e3] dark:text-[#0a84ff]' : 'text-[#86868b] dark:text-[#98989d]'
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
                currentTab === tab.id ? 'text-[#0071e3] dark:text-[#0a84ff] font-medium' : 'text-[#86868b] dark:text-[#98989d]'
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
      />

      {/* Alert Dialog - Session / Health Score */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent className="max-w-sm rounded-2xl bg-white/95 dark:bg-[#1c1c1e] backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className={cn('text-[17px] font-semibold', alertInfo.level === 'danger' ? 'text-[#ff3b30] dark:text-[#ff453a]' : 'text-[#ff9500] dark:text-[#ff9f0a]')}>
              {alertInfo.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[14px] text-[#1d1d1f] dark:text-white leading-relaxed">{alertInfo.message}</p>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={() => setAlertOpen(false)} className="flex-1 rounded-xl min-h-[44px]">
              知道了
            </Button>
            {!data?.session_valid && (
              <Button onClick={() => { setAlertOpen(false); }} className="flex-1 rounded-xl bg-[#ff3b30] hover:bg-[#ff3b30]/90 active:bg-[#ff3b30]/80 text-white min-h-[44px]">
                去更新
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Report Dialog */}
      <Dialog open={aiReportOpen} onOpenChange={setAiReportOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white/95 dark:bg-[#1c1c1e] backdrop-blur-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold text-[#1d1d1f] dark:text-white">📊 AI 日报</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-0">
            {data?.ai_report ? (
              <div className="text-[14px] text-[#1d1d1f] dark:text-white whitespace-pre-wrap leading-relaxed">{data.ai_report}</div>
            ) : (
              <div className="text-center py-8">
                <div className="text-[#86868b] dark:text-[#98989d] text-sm">今日日报尚未生成</div>
                <div className="text-[#c7c7cc] dark:text-[#636366] text-xs mt-1">每天 22:30 自动生成</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          zIndex: 9999,
          transition: 'opacity 0.3s',
          opacity: toast.visible ? 1 : 0,
          pointerEvents: toast.visible ? 'auto' : 'none',
        }}
      >
        {toast.message}
      </div>
    </div>
  );
}
