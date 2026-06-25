export const SEVERITY_COLORS: Record<string, string> = {
  '严重': '#ff3b30',
  '中等': '#ff9500',
  '轻微': '#ffcc00',
  '警告': '#5ac8fa',
  '正常': '#34c759',
};

export const SEVERITY_LABELS: Record<string, string> = {
  '严重': '严重',
  '中等': '中等',
  '轻微': '轻微',
  '警告': '警告',
  '正常': '正常',
};

/**
 * Severity badge class map (Tailwind classes).
 * Covers both English (HIGH/MED/LOW/WARN) and Chinese (严重/中等/轻微/警告) keys
 * used across AnomalyPanel, OverviewPanel, and SkipScanPanel.
 */
export const SEVERITY_BADGE_CLASSES: Record<string, string> = {
  HIGH: 'bg-[#ff3b30]/10 text-[#ff3b30]',
  MED: 'bg-[#ff9500]/10 text-[#ff9500]',
  LOW: 'bg-[#ffcc00]/10 text-[#9a6700]',
  WARN: 'bg-[#86868b]/10 text-[#86868b]',
  '严重': 'bg-[#ff3b30]/10 text-[#ff3b30]',
  '中等': 'bg-[#ff9500]/10 text-[#ff9500]',
  '轻微': 'bg-[#ffcc00]/10 text-[#9a6700]',
  '警告': 'bg-[#86868b]/10 text-[#86868b]',
};

/**
 * Severity label map (English -> Chinese).
 * Covers both English and Chinese keys.
 */
export const SEVERITY_LABEL_MAP: Record<string, string> = {
  HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告',
  '严重': '严重', '中等': '中等', '轻微': '轻微', '警告': '警告',
};
