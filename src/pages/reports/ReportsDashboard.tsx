/**
 * ReportsDashboard — the bare #reports overview (RAPPORTEN-DASHBOARD-1, Danny
 * 14-08: "#reports moet hoofddashboard worden met belangrijkste KPI's, wederom
 * negen KPI rows"). Nine cards through the same shared InsightsRow strip every
 * report already uses, each number pulled from an EXISTING report endpoint via
 * its own use*Report hook (no new endpoint, no invented totals) and each card
 * clicks through to the sub-report the number came from. The shared period
 * lives ONLY in the right-hand filter panel now (RIGHTPANEL-FILTERS-1,
 * 2026-08-14) — `period` still drives every hook below it, ReportsPage just no
 * longer threads a duplicate inline picker down through a `tabsSlot` prop.
 */
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useNavigation } from '@/context/NavigationContext'
import { useAuth } from '@/context/AuthContext'
import { useCandidatesReport } from './useCandidatesReport'
import { useApplicationsReport } from './useApplicationsReport'
import { useCustomersReport } from './useCustomersReport'
import { useVacanciesReport } from './useVacanciesReport'
import { useMatchesReport } from './useMatchesReport'
import { useTasksReport } from './useTasksReport'
import { useOpportunitiesReport } from './useOpportunitiesReport'
import { useOutreachReport } from './useOutreachReport'
import { useWhatsappReport } from './useWhatsappReport'
import type { ReportId } from './reportIds'
import type { ReportPeriod } from '@/types/analytics'

// One row's shape after normalising its hook's four states down to what the
// KPI card needs — total/loading/error, plus the sub-report it drills into.
type Row = { key: string; label: string; page: ReportId; loading: boolean; error: boolean; total: number | null }

export default function ReportsDashboard({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { navigate } = useNavigation()

  // Nine existing report endpoints, called unconditionally (Rules of Hooks) —
  // exactly Danny's "wederom 9 KPI rows", each number sourced from its own
  // sub-report so the dashboard never invents a number the sub-page can't back up.
  const candidates    = useCandidatesReport(period)
  const applications  = useApplicationsReport(period)
  const customers     = useCustomersReport(period)
  const vacancies     = useVacanciesReport(period)
  const matches       = useMatchesReport(period)
  const tasks         = useTasksReport(period)
  const opportunities = useOpportunitiesReport(period)
  // RAPPORTEN-DANNY10-1: the flow tile retired with its page; outreach and
  // whatsapp (RAPPORTEN-WHATSAPP-FE-1) fill the eighth and ninth cards so the
  // row stays at nine real numbers.
  const outreach      = useOutreachReport(period)
  // The whatsapp report sits behind module:whatsapp — without the module the
  // tile hides AND the fetch never fires (it would only 403). Hook still called
  // unconditionally (Rules of Hooks); `enabled` guards the request.
  const auth = useAuth()
  const hasWhatsapp = (auth?.hasModule ?? (() => false))('whatsapp')
  const whatsapp      = useWhatsappReport(period, hasWhatsapp)

  // Danny 24-08: the hub tiles carry the SIDEBAR names (tabs.*) in the SIDEBAR
  // order (REPORT_IDS) — a tile is the entity's entry card, so it wears the
  // entity's name, never its report's own total-label wording.
  const rows: Row[] = [
    { key: 'candidates',    label: t('tabs.candidates'),    page: 'candidates',    loading: candidates.loading,    error: candidates.error,    total: candidates.data?.total ?? null },
    { key: 'applications',  label: t('tabs.applications'),  page: 'applications',  loading: applications.loading,  error: applications.error,  total: applications.data?.total ?? null },
    { key: 'customers',     label: t('tabs.customers'),     page: 'customers',     loading: customers.loading,     error: customers.error,     total: customers.data?.total ?? null },
    { key: 'vacancies',     label: t('tabs.vacancies'),     page: 'vacancies',     loading: vacancies.loading,     error: vacancies.error,     total: vacancies.data?.total ?? null },
    { key: 'opportunities', label: t('tabs.opportunities'), page: 'opportunities', loading: opportunities.loading, error: opportunities.error, total: opportunities.data?.total ?? null },
    { key: 'tasks',         label: t('tabs.tasks'),         page: 'tasks',         loading: tasks.loading,         error: tasks.error,         total: tasks.data?.total ?? null },
    { key: 'matches',       label: t('tabs.matches'),       page: 'matches',       loading: matches.loading,       error: matches.error,       total: matches.data?.total ?? null },
    { key: 'outreach',      label: t('tabs.outreach'),      page: 'outreach',      loading: outreach.loading,      error: outreach.error,      total: outreach.data?.total ?? null },
    ...(hasWhatsapp ? [{ key: 'whatsapp',   label: t('tabs.whatsapp'),      page: 'whatsapp' as ReportId,   loading: whatsapp.loading,      error: whatsapp.error,      total: whatsapp.data?.meta.total ?? null }] : []),
  ]

  const kpis: KpiSpec[] = rows.map(r => ({
    key: r.key,
    label: r.label,
    // Loading/error render as an honest placeholder, and a genuinely missing
    // total (hook resolved but the field was absent) renders the same house
    // dash — never a fabricated 0 standing in for a number the server didn't
    // send (CLAUDE.md: "never a padded zero").
    value: r.loading ? '…' : (r.error || r.total == null) ? '—' : r.total,
    onClick: () => navigate(`reports.${r.page}`),
  }))

  return (
    <div>
      <ReportKpiBand kpis={kpis} />
    </div>
  )
}
