/**
 * Severity badge class map (Tailwind classes).
 * Covers both English (HIGH/MED/LOW/WARN) and Chinese (严重/中等/轻微/警告) keys
 * used across AnomalyPanel, OverviewPanel, and SkipScanPanel.
 */
export const SEVERITY_BADGE_CLASSES: Record<string, string> = {
  HIGH: 'bg-[#ff3b30]/10 text-[#ff3b30] dark:bg-[#ff453a]/15 dark:text-[#ff453a]',
  MED: 'bg-[#ff9500]/10 text-[#ff9500] dark:bg-[#ff9f0a]/15 dark:text-[#ff9f0a]',
  LOW: 'bg-[#b8860b]/10 text-[#b8860b] dark:bg-[#ffd60a]/15 dark:text-[#ffd60a]',
  WARN: 'bg-[#5ac8fa]/10 text-[#007aff] dark:bg-[#5ac8fa]/15 dark:text-[#5ac8fa]',
  '严重': 'bg-[#ff3b30]/10 text-[#ff3b30] dark:bg-[#ff453a]/15 dark:text-[#ff453a]',
  '中等': 'bg-[#ff9500]/10 text-[#ff9500] dark:bg-[#ff9f0a]/15 dark:text-[#ff9f0a]',
  '轻微': 'bg-[#b8860b]/10 text-[#b8860b] dark:bg-[#ffd60a]/15 dark:text-[#ffd60a]',
  '警告': 'bg-[#5ac8fa]/10 text-[#007aff] dark:bg-[#5ac8fa]/15 dark:text-[#5ac8fa]',
};

/**
 * Severity label map (English -> Chinese).
 * Covers both English and Chinese keys.
 */
export const SEVERITY_LABEL_MAP: Record<string, string> = {
  HIGH: '严重', MED: '中等', LOW: '轻微', WARN: '警告',
  '严重': '严重', '中等': '中等', '轻微': '轻微', '警告': '警告',
};

/**
 * Anomaly type badge classes (colored background pill).
 */
export const TYPE_BADGE_CLASSES: Record<string, string> = {
  '分拣超时': 'bg-[#ff3b30]/10 text-[#ff3b30] dark:bg-[#ff453a]/15 dark:text-[#ff453a]',
  '配送超时': 'bg-[#ffcc00]/10 text-[#9a6700] dark:bg-[#ffd60a]/15 dark:text-[#ffd60a]',
  '压单': 'bg-[#86868b]/10 text-[#86868b] dark:bg-[#98989d]/15 dark:text-[#98989d]',
};
