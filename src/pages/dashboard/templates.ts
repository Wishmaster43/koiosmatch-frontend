/**
 * Dashboard templates (B-27) — which blocks each role's dashboard shows. Block ids
 * are gated in Dashboard.tsx via `visibleBlock`; `['*']` = show everything (so the
 * management/super view stays identical to the full dashboard — nothing is removed).
 *
 * Seed defaults; Settings → Dashboards will later persist per-type overrides
 * (mirrors the ViewConfigEditor pattern). The dashboard_type enum is owned by the
 * backend (C-35) — keep this list in sync, never diverge.
 */
export const DASHBOARD_TYPES = ['management', 'recruiter', 'planner', 'readonly'] as const
export type DashboardType = typeof DASHBOARD_TYPES[number]

// Multi-role users: the richest dashboard wins.
export const TYPE_PRECEDENCE: DashboardType[] = ['management', 'recruiter', 'planner', 'readonly']

// Block ids used across the dashboard (KPI keys + charts + recent lists).
export const DASH_BLOCKS = {
  kpi: ['kpi.candidates', 'kpi.stale', 'kpi.never', 'kpi.tasks', 'kpi.opps', 'kpi.pipeline'],
  chart: ['chart.status', 'chart.recruiter', 'chart.funnel', 'chart.funnelConversion', 'chart.oppStage', 'chart.weekly'],
  list: ['list.candidates', 'list.applications', 'list.leads', 'list.runs', 'list.conversations'],
} as const

// Per-type block sets. '*' = everything (management/super — full current dashboard).
export const DASHBOARD_TEMPLATES: Record<DashboardType, string[]> = {
  management: ['*'],
  recruiter: [
    'kpi.candidates', 'kpi.stale', 'kpi.never', 'kpi.tasks',
    'chart.status', 'chart.funnel', 'chart.funnelConversion',
    'list.candidates', 'list.applications', 'list.conversations',
  ],
  planner: [
    'kpi.tasks',
    'chart.weekly',
    'list.runs', 'list.conversations',
    // TODO (data available): WhatsApp-queue · open shifts · incomplete workflow runs.
  ],
  readonly: [
    'kpi.candidates', 'kpi.tasks',
    'chart.status', 'chart.funnel',
  ],
}

// Is a block visible for the active dashboard type?
export const visibleBlock = (type: string, id: string): boolean => {
  const tpl = DASHBOARD_TEMPLATES[type as DashboardType] ?? ['*']
  return tpl.includes('*') || tpl.includes(id)
}

// Resolve the effective type from a user's roles (richest wins; readonly fallback).
export const resolveDashboardType = (types: string[]): DashboardType => {
  for (const t of TYPE_PRECEDENCE) if (types.includes(t)) return t
  return 'readonly'
}
