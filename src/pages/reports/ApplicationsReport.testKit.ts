/** Shared DATA fixture for the ApplicationsReport suites (plain data, no mocks). */
import type { ApplicationsReportData } from '@/types/analytics'

export const data: ApplicationsReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', total: 20,
  timeseries: { bucket: 'week', series: [{ date: '2026-08-03', label: 'Wk 32', value: 8 }, { date: '2026-08-10', label: 'Wk 33', value: 12 }] },
  by_bucket: { active: 10, matched: 4, rejected: 3, placed: 3 },
  by_stage: [
    // eslint-disable-next-line no-restricted-syntax -- DATA: server lookup colour in a test fixture, not UI styling
    { value: 'applied', label: 'Applied', color: '#16a34a', count: 10, direct_entries: 4 },
    { value: 'none', label: 'Geen fase', color: null, count: 2, direct_entries: 0 },
  ],
  by_source: [{ value: 'referral', label: 'Referral', color: null, count: 6 }],
  by_owner: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 12 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 8 },
  ],
  by_customer: [
    { value: 'c1', label: 'Yesway Flex', count: 15 },
    { value: 'none', label: 'Geen klant', count: 3 },
    { value: 'others', label: 'Overig', count: 2 },
  ],
  by_vacancy: [
    { value: 'v1', label: 'Verpleegkundige (gearchiveerd)', count: 9 },
    { value: 'others', label: 'Overig', count: 1 },
  ],
  by_stage_duration: [
    { value: 'applied', label: 'Applied (duration)', count: 5, avg_days_in_phase: 12.5 },
    { value: 'intake', label: 'Intake (duration)', count: 3, avg_days_in_phase: 4 },
  ],
  // RAPPORT-APPS-VERDIEPING-1: the nine server-card envelope, ignored server
  // `label` (§5 — labels come from i18n, mirrors WhatsappReportData fixture).
  kpis: [
    { key: 'total', label: 'ignored', count: 20 },
    { key: 'new', label: 'ignored', count: 5 },
    { key: 'active', label: 'ignored', count: 10 },
    { key: 'matched', label: 'ignored', count: 4 },
    { key: 'rejected', label: 'ignored', count: 3 },
    { key: 'conversion_pct', label: 'ignored', count: 20 },
    { key: 'avg_days_to_match', label: 'ignored', count: 6 },
    { key: 'too_long_in_stage', label: 'ignored', count: 2 },
    { key: 'missing_appointment', label: 'ignored', count: 1 },
  ],
  intakes: {
    planned: 13, done_in_period: 11,
    by_recruiter: [{ owner_id: 'u2', name: 'Bram Smit', count: 3 }],
    by_branch: [{ value: 'b1', label: 'Amsterdam', count: 4 }],
  },
}
