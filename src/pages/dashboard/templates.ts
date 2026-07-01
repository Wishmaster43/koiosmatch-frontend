/**
 * Dashboard templates (B-27) — per role: which KPI row (KPI_ROWS) and which charts/
 * lists (DASHBOARD_TEMPLATES, gated via `visibleBlock`). Every role ALWAYS gets a
 * full, role-specific KPI row; `['*']` = show every chart/list (admin/management).
 *
 * The `dashboard_type` enum is OWNED BY THE BACKEND (C-35) and is leading — these
 * are the confirmed values (docs/DASHBOARD-PLAN.md): never diverge. `/auth/me`
 * returns roles[].dashboard_type.
 */
export const DASHBOARD_TYPES = ['admin', 'management', 'recruitment', 'backoffice', 'sales', 'planning', 'readonly'] as const
export type DashboardType = typeof DASHBOARD_TYPES[number]

// Multi-role users: the richest dashboard wins.
export const TYPE_PRECEDENCE: DashboardType[] = ['admin', 'management', 'recruitment', 'backoffice', 'sales', 'planning', 'readonly']

// Types allowed to switch/preview every role's view (see everything).
export const SUPER_VIEWS: DashboardType[] = ['admin', 'management']

// ── KPI row per role — bare KPI ids resolved in Dashboard.tsx (kpiById). Every role
// shows a full, role-specific row (never hidden). 🟡 metrics render "—" until the
// backend feed lands (see docs/DASHBOARD-PLAN.md).
export const KPI_ROWS: Record<DashboardType, string[]> = {
  admin:       ['candidates', 'opps', 'pipeline', 'placements', 'intakes', 'fillRate'],
  management:  ['candidates', 'opps', 'pipeline', 'placements', 'intakes', 'fillRate'],
  recruitment: ['candidates', 'tasks', 'intakes', 'failedWa', 'never', 'activeConv'],
  backoffice:  ['tasks', 'placements', 'missingDocs', 'expiringContracts', 'couplingErrors', 'incompleteRuns'],
  sales:       ['opps', 'pipeline', 'fillRate', 'placements', 'activeConv', 'tasks'],
  planning:    ['waQueue', 'failedWa', 'incompleteRuns', 'tasks', 'openShifts', 'occupancy'],
  readonly:    ['candidates', 'tasks', 'stale'],
}

// ── Charts/lists per role. '*' = everything (admin/management = full dashboard).
export const DASHBOARD_TEMPLATES: Record<DashboardType, string[]> = {
  admin: ['*'],
  management: ['*'],
  recruitment: ['block.touchpoints', 'block.attention', 'chart.status', 'chart.funnel', 'chart.funnelConversion', 'list.candidates', 'list.applications', 'list.conversations'],
  backoffice: ['chart.status', 'list.applications', 'list.runs'],
  sales: ['chart.oppStage', 'chart.status', 'list.leads'],
  planning: ['block.waQueue', 'block.shifts', 'chart.weekly', 'list.runs', 'list.conversations'],
  readonly: ['chart.status', 'chart.funnel'],
}

// Is a chart/list block visible for the active dashboard type?
export const visibleBlock = (type: string, id: string): boolean => {
  const tpl = DASHBOARD_TEMPLATES[type as DashboardType] ?? ['*']
  return tpl.includes('*') || tpl.includes(id)
}

// KPI ids for the active type (fallback to management's row).
export const kpiRow = (type: string): string[] =>
  KPI_ROWS[type as DashboardType] ?? KPI_ROWS.management

// May this type switch/preview every dashboard view?
export const canSwitchViews = (type: string): boolean => SUPER_VIEWS.includes(type as DashboardType)

// Resolve the effective type from a user's roles (richest wins; readonly fallback).
export const resolveDashboardType = (types: string[]): DashboardType => {
  for (const t of TYPE_PRECEDENCE) if (types.includes(t)) return t
  return 'readonly'
}
