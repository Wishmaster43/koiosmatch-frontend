/** OutreachReport fixtures: report payload and KPI suite shared by the split suites (plain data). */
import type { OutreachReportData } from '@/types/analytics'

// Portie-6 payload: the fase-1 fields (total_targets/reached/reach_rate + legacy
// status/outcome keys) are still present; every new axis sums to `total`. The
// series has NO ghost zero-bucket — series[0].date === from.
export const data: OutreachReportData = {
  period: 'month', from: '2026-05-14', to: '2026-08-14',
  total_targets: 40, reached: 25, reach_rate: 0.63, total: 40,
  timeseries: { bucket: 'week', series: [
    { date: '2026-05-14', label: 'Wk 20', value: 18 },
    { date: '2026-08-10', label: 'Wk 33', value: 22 },
  ] },
  by_status: [
    { status: 'contacted', value: 'contacted', label: 'Benaderd', count: 25 },
    { status: 'new', value: 'new', label: 'Nieuw', count: 11 },
    // Orphan-string status: its own "Onbekend" bar, drillable on the RAW value.
    { status: 'weird-legacy-status', value: 'weird-legacy-status', label: 'Onbekend', count: 4 },
  ],
  by_outcome: [
    { outcome: 'interested', value: 'interested', label: 'Interested', count: 10, share_of_reached: 0.4 },
    { outcome: 'not_interested', value: 'not_interested', label: 'Geen interesse', count: 15, share_of_reached: 0.6 },
    // The sentinel that makes the axis sum to total (targets without any outcome).
    { outcome: 'none', value: 'none', label: 'Geen uitkomst', count: 15, share_of_reached: null },
  ],
  by_campaign: [
    { value: 'camp-1', label: 'Bellijst Q3 wondzorg', count: 20 },
    // An archived campaign keeps its real name and stays drillable on its uuid.
    { value: 'camp-archived-uuid', label: 'Voorjaarsactie 2026', count: 12 },
    { value: 'others', label: 'Overige bellijsten', count: 8 },
  ],
  by_assignee: [
    { owner_id: 'u1', name: 'Anna de Vries', count: 30 },
    { owner_id: 'none', name: 'Niet toegewezen', count: 10 },
  ],
  channel_funnel: [
    { channel: 'call', total: 12, reached: 8, applied: 3, placed: 1 },
  ],
  by_channel: [
    { value: 'phone', label: 'Telefoon', count: 26 },
    { value: 'whatsapp', label: 'WhatsApp', count: 9 },
    { value: 'none', label: 'Geen kanaal', count: 5 },
  ],
}

// KPI-OUTREACH-1: the server suite the strip renders verbatim — one entry per
// drill-enum key, value and drawer sharing one backend predicate.
export const suiteKpis = [
  { key: 'total_targets', count: 40 }, { key: 'open_todo', count: 12 },
  { key: 'called_in_period', count: 28 }, { key: 'reached', count: 25 },
  { key: 'not_reached', count: 15 }, { key: 'conversion_pct', count: 62.5 },
  { key: 'campaigns_active', count: 3 }, { key: 'campaigns_done_in_period', count: 1 },
  { key: 'due_today', count: 4 },
]
export const dataWithSuite: OutreachReportData = { ...data, kpis: suiteKpis }
