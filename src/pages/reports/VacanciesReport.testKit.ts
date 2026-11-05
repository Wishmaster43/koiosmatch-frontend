/** Shared DATA fixtures for the VacanciesReport suites (plain data, no mocks). */
import type { VacanciesReportData } from '@/types/analytics'

export const row = {
  key: 'v1', label: 'Verpleegkundige IC', code: 'VAC-1',
  status: { value: 'open', label: 'Open' },
  customer: { id: 'c1', name: 'Rivas Zorggroep' },
  applications: 4, applications_by_phase: [], matched: 2, filled: false, time_to_fill_days: null,
}
export const data: VacanciesReportData = {
  period: 'month', from: '2026-05-14', to: '2026-08-14',
  summary: {
    total: 12, open: 8, filled: 4, fill_rate: 0.33, avg_time_to_fill_days: 11.4, stale_online: 2, long_concept: 1, no_matches: 3,
    advice_stale: 2, advice_stale_days: 14, closing_soon: 1, closing_soon_days: 7,
  },
  vacancies: [row],
  total: 12,
  timeseries: { bucket: 'week', series: [
    { date: '2026-08-03', label: 'Wk 32', value: 5 },
    { date: '2026-08-10', label: 'Wk 33', value: 7 },
  ] },
  by_status: [
    // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
    { value: 'st-uuid-1', label: 'Gepubliceerd', color: '#16a34a', count: 6 },
    { value: 'none', label: 'Geen status', color: null, count: 3 },
    { value: '9c1d-deleted-status-uuid', label: 'Onbekend (verwijderde status)', color: null, count: 3 },
  ],
  by_customer: [
    { value: 'cust-1', label: 'Careyn', count: 7 },
    { value: 'none', label: 'Geen klant', count: 3 },
    { value: 'others', label: 'Overig', count: 2 },
  ],
  by_function: [
    { value: 'Verzorgende IG', label: 'Verzorgende IG', count: 9 },
    { value: 'none', label: 'Geen functie', count: 2 },
    { value: 'others', label: 'Overig', count: 1 },
  ],
  by_industry: [{ value: 'Zorg', label: 'Zorg', color: null, count: 12 }],
  by_owner: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 9 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 3 },
  ],
  by_branch: [{ value: 'utrecht', label: 'Utrecht', color: null, count: 12 }],
}

// KPI-VAC-1 (CMBE 28-08, BuildsVacancyKpis): the strip now reads the server's
// own nine-card kpis[] suite verbatim — supersedes the old summary/top-segment
// KPI tests (topIndustry/topOwner/topFunction/topBranch/adviceStale/ttf
// left the strip; their data keeps a surface below — see VacanciesReport.tsx's
// KPI-VAC-1 comment). Distinct numeric values per card so each is an
// unambiguous text node against the rest of the page.
export const vacancyKpis: NonNullable<VacanciesReportData['kpis']> = [
  { key: 'total', count: 84 },
  { key: 'open', count: 51 },
  { key: 'filled', count: 29 },
  { key: 'fill_rate', count: 0.345, unit: 'ratio' },
  { key: 'stale_online', count: 17 },
  { key: 'long_concept', count: 13 },
  { key: 'no_matches', count: 19 },
  { key: 'closing_soon', count: 23 },
  { key: 'customers_count', count: 37 },
]
export const dataWithKpis: VacanciesReportData = { ...data, kpis: vacancyKpis }
