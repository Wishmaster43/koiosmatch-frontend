/** useDashboardViewModel test kit: the minimal hook args shared by the split suites. */
// Minimal args — only the fields the recruitment KPI row + attention merge read.
export const baseArgs = (overrides: Record<string, unknown> = {}) => ({
  t: (k: string) => k,
  formatNumber: (v: number) => String(v),
  stats: null,
  opp: null,
  dash: null,
  dashCharts: null,
  statusMeta: () => ({ value: '', label: '', color: '' }),
  funnelMeta: () => ({ value: '', label: '', color: '' }),
  funnelTypes: [],
  activeType: 'recruitment' as const,
  hiddenBlocks: [],
  hiddenKpis: [],
  hasPlanning: false,
  ...overrides,
})
