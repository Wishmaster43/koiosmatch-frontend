/** Shared DATA fixtures for the CandidatesReport suites (plain data, no mocks). */
import type { CandidatesReportData } from '@/types/analytics'

export const data: CandidatesReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 12,
  timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 5 }, { date: '2026-08-10', label: 'Wk 33', value: 7 }] },
  // eslint-disable-next-line no-restricted-syntax -- NECESSITY: fixture seed data, not a component style
  by_status:  [{ value: 'available', label: 'Beschikbaar', color: '#16a34a', count: 8 }, { value: 'placed', label: 'Geplaatst', color: '#2563eb', count: 4 }],
  by_phase:   [{ value: 'lead', label: 'Lead', color: null, count: 3 }, { value: 'candidate', label: 'Kandidaat', color: null, count: 9 }],
  by_source:  [{ value: 'referral', label: 'Referral', color: null, count: 6 }],
  by_owner:   [{ owner_id: 'u1', name: 'Anna de Vries', count: 8 }, { owner_id: 'none', name: 'Niet toegewezen', count: 4 }],
  by_branch:  [{ value: 'utrecht', label: 'Utrecht', color: null, count: 12 }, { value: 'none', label: 'Geen vestiging', color: null, count: 2 }],
}

// The real nine-key suite (GET /reports/candidates/kpis) — status_stale 0 pins
// the calm-zero case, and dropping a key pins the honest dash.
export const suiteCards = [
  { key: 'inflow', count: 12 }, { key: 'outflow', count: 2 }, { key: 'no_followup', count: 5 },
  { key: 'status_stale', count: 0 }, { key: 'no_cv', count: 3 }, { key: 'document_expiring', count: 1 },
  { key: 'availability_due', count: 2 }, { key: 'no_contact', count: 4 }, { key: 'active_conversations', count: 6 },
]
