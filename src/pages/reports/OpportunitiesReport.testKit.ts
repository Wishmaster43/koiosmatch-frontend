/** Shared DATA fixtures for the OpportunitiesReport suites (plain data, no mocks). */
import type { OpportunitiesReportData } from '@/types/analytics'

export const data: OpportunitiesReportData = {
  period: { from: '2026-05-14', to: '2026-08-14' },
  total: 12,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-03', label: 'Wk 32', value: 5 },
    { date: '2026-08-10', label: 'Wk 33', value: 7 },
  ] },
  totals: {
    total: 12, open: 6, won: 4, lost: 2, win_rate: 66.7, open_value: 25000, open_hours: 120, won_value: 18000,
    stale: 2, stale_days: 30, closing_soon: 3, closing_soon_days: 14,
  },
  by_stage: [
    // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
    { key: 'proposal', value: 'proposal', label: 'Voorstel', color: '#2563eb', count: 6, value_sum: 15000 },
    { key: 'none', value: 'none', label: 'Geen fase', color: null, count: 3, value_sum: 0 },
    { key: '9c1d-deleted-stage-uuid', value: '9c1d-deleted-stage-uuid', label: 'Onbekend (verwijderde fase)', color: null, count: 3, value_sum: 2500 },
  ],
  by_owner: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 9 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 3 },
  ],
  by_customer: [
    { customer_id: 'cust-1', value: 'cust-1', name: 'Careyn', label: 'Careyn', count: 5, value_sum: 12000 },
    { customer_id: 'f0a3-deleted-customer-uuid', value: 'f0a3-deleted-customer-uuid', name: 'Onbekend', label: 'Onbekend', count: 3, value_sum: 900 },
    { customer_id: 'none', value: 'none', name: 'Geen klant', label: 'Geen klant', count: 2, value_sum: 0 },
    { customer_id: 'others', value: 'others', name: 'Overig', label: 'Overig', count: 2, value_sum: 400 },
  ],
  by_branch: [
    { value: 'loc-1', label: 'Utrecht', count: 10 },
    { value: 'none', label: 'Geen vestiging', count: 2 },
  ],
  forecast: [{ month: '2026-09', count: 2, value_sum: 8000 }],
  stale: { untouched_days: 30, untouched: 1, overdue: 1 },
}

// KPI-OPP-1 (CMBE 27-08, commit eb3af985): the strip now reads the server's own
// nine-card kpis[] suite verbatim — supersedes the old totals/forecast-derived
// strip tests. Assertions key on the fixture's own DISTINCT numeric
// values and the drill request's `kpi` param rather than on label text, since
// the `opportunities.kpi.*` copy already exists (see the ground-rule note) but
// this lane never re-verifies locale-file content. Deliberately distinct from
// every other digit the fixture already renders elsewhere on the page.
export const opportunityKpis: NonNullable<OpportunitiesReportData['kpis']> = [
  { key: 'total', count: 120 },
  { key: 'open', count: 55 },
  { key: 'won', count: 41 },
  { key: 'lost', count: 14 },
  { key: 'win_rate', count: 74.5, unit: 'pct' },
  { key: 'open_value', count: 32000, unit: 'euro' },
  { key: 'stale', count: 6 },
  { key: 'closing_soon', count: 9 },
  { key: 'overdue', count: 3 },
]
export const dataWithKpis: OpportunitiesReportData = { ...data, kpis: opportunityKpis }
