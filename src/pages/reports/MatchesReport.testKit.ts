/** Shared DATA fixtures for the MatchesReport suites (plain data, no mocks). */
import type { MatchesReportData } from '@/types/analytics'

export const data: MatchesReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 16,
  by_origin: { funnel: 10, direct: 6 },
  timeseries: { bucket: 'week', series: [
    { date: '2026-07-27', label: 'Wk 31', value: 9 },
    { date: '2026-08-03', label: 'Wk 32', value: 7 },
  ] },
  by_contract_form: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'secondment', label: 'Detachering', color: '#16a34a', count: 9 },
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'temp_agency', label: 'Uitzend', color: '#2563eb', count: 4 },
    { value: 'none', label: 'Geen contractvorm', color: null, count: 2 },
    { value: 'zzz-deleted-form', label: 'Onbekend (verwijderde contractvorm)', color: null, count: 1 },
  ],
  // `none` explicit since 7925ce15 (16 total - 13 under contract = 3).
  under_contract: { sent: 5, active: 6, ended: 2, none: 3, total: 13 },
  placements: { sent: 5, active: 6, ended: 2, total: 13 },
  terminations: { total: 3, by_reason: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { key: 'client_stop', value: 'client_stop', label: 'Klant stopt', color: '#dc2626', count: 2 },
    { key: 'own_choice', value: 'own_choice', label: 'Eigen keuze', color: null, count: 1 },
  ] },
  avg_placement_duration_days: null,
}

// KPI-MATCHES-1 (CMBE 27-08, BuildsMatchKpis): the strip now reads the
// server's own nine-card kpis[] suite verbatim — supersedes the old
// origin/placements/derived-stat strip tests of the old suite. Assertions key on the
// fixture's own DISTINCT numeric values and the drill request's `kpi` param
// rather than on label text, since the `matches.kpi.*` copy is landed by the
// manager in a separate i18n change (this lane never touches locale files).
// Deliberately distinct from every other digit the fixture already renders
// (the under_contract StatTiles show 5/6/2/3 further down the same page) so
// each suite card's value is a unique, unambiguous text node.
export const matchKpis: NonNullable<MatchesReportData['kpis']> = [
  { key: 'total', count: 120 },
  { key: 'new_in_period', count: 45 },
  { key: 'active', count: 112 },
  { key: 'expiring_soon', count: 33 },
  { key: 'terminated_in_period', count: 44 },
  { key: 'renewals_in_period', count: 22 },
  { key: 'without_end_date', count: 66 },
  { key: 'avg_duration_days', count: 47.6 },
  { key: 'reach_rate', count: 0.375 },
]
export const dataWithKpis: MatchesReportData = { ...data, kpis: matchKpis }
