/** Shared DATA fixtures for the TasksReport suites (plain data, no mocks). */
import type { TasksReportData } from '@/types/analytics'

export const data: TasksReportData = {
  period: 'month',
  from: '2026-08-01',
  to: '2026-08-31',
  total: 12,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-01', label: 'Wk 31', value: 5 },
    { date: '2026-08-10', label: 'Wk 32', value: 7 },
  ] },
  summary: { open: 6, done: 4, overdue: 2, done_rate: 33.3 },
  by_status: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'status-uuid-1', label: 'Te doen', color: '#2563eb', is_done: false, count: 6 },
    { value: 'none', label: 'Onbekend (geen status)', color: null, is_done: false, count: 3 },
    { value: '9c1d-deleted-status-uuid', label: 'Onbekend (verwijderde status)', color: null, is_done: false, count: 3 },
  ],
  by_type: [
    { value: 'type-uuid-1', label: 'Bellen', count: 8 },
    { value: 'none', label: 'Geen type', count: 4 },
  ],
  by_priority: [
    { value: 'prio-uuid-1', label: 'Hoog', count: 9 },
    { value: 'none', label: 'Geen prioriteit', count: 3 },
  ],
  by_assignee: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 9 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 3 },
  ],
  by_team: [
    { value: 'team-1', label: 'Recruitment', count: 10 },
    { value: 'none', label: 'Geen afdeling', count: 2 },
  ],
  by_branch: [
    { value: 'loc-1', label: 'Utrecht', count: 10 },
    { value: 'none', label: 'Geen vestiging', count: 2 },
  ],
}

// KPI-TAKEN-1: the server suite the strip renders verbatim — one entry per
// drill-enum key, value and drawer sharing one backend predicate.
export const suiteKpis = [
  { key: 'total', count: 12 }, { key: 'open', count: 6 }, { key: 'overdue', count: 2 },
  { key: 'done_in_period', count: 4 }, { key: 'created_in_period', count: 20 },
  { key: 'due_today', count: 1 }, { key: 'due_this_week', count: 3 },
  { key: 'without_assignee', count: 3 }, { key: 'avg_completion_days', count: 2.5 },
]
export const dataWithSuite: TasksReportData = { ...data, kpis: suiteKpis }
