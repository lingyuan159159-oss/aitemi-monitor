export function getChartTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    isDark,
    customTooltipStyle: {
      backgroundColor: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(8px)',
      border: 'none',
      borderRadius: '12px',
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.08)',
      padding: '6px 10px',
      fontSize: '11px',
      color: isDark ? '#ffffff' : '#1d1d1f',
    },
  };
}
