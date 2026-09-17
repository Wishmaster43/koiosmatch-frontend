/**
 * buildCustomerInsightsConfig — the customer page's KPI strip (2 donuts + 7 KPI
 * cards, KPI-RIJ-9-1: 9 total) as a pure config builder. Extracted from
 * CustomersPage once it crossed the ~400-line split trigger (§0.3) — mirrors
 * buildVacancyInsightsConfig; no new behaviour beyond the O22 9th card, the
 * page only wires state in and renders the result.
 *
 * TOTALS-NESTING-1 (measured 17-09 against GET /customers/stats on demo): the
 * six counts live under a `totals` object (`{ total, by_status, by_owner,
 * totals: { locations, departments, … } }`), never top-level — this file used
 * to read `stats?.locations` etc directly, so it silently fell through to the
 * page-derived fallback sum on every real response. Fixed here alongside the
 * 9th card (same file, same root cause).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { pickCustomerStatusSegment } from './customerInsights'
import { pickKey, toggleOneValue } from '@/lib/chartSelection'

// Single-select toggle: clicking the active segment clears it again.
const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (v: string | undefined) => { if (v != null) toggleOneValue(set, v) }

// The server-wide stats aggregate (fallback: sum the loaded page) — see
// TOTALS-NESTING-1 above: the real counts sit under `totals`.
interface StatsLike {
  totals?: {
    locations?: number; departments?: number; contacts?: number
    open_vacancies?: number; active_matches?: number; without_contact?: number
    open_opportunities?: number
  }
}
interface RowCounts {
  locationsCount: number; departmentsCount: number; contactsCount: number
  openVacanciesCount: number; activeMatchesCount: number
}
interface Datum { name: string; value: number; key?: string; color?: string }

interface Args {
  t: TFunction
  stats: StatsLike | null | undefined
  customers: RowCounts[]
  statusData: Datum[]
  ownerData: Datum[]
  entryPhaseValue?: string
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedPhase: string[];  setSelectedPhase: Dispatch<SetStateAction<string[]>>
  selectedOwner: string[];  setSelectedOwner: Dispatch<SetStateAction<string[]>>
  kpiFilter: string | null
  toggleKpi: (k: string) => void
}

// Pure builder for the customers KPI/insights strip (see file docblock above) —
// server-wide totals win, the loaded page is only the honest fallback.
export function buildCustomerInsightsConfig({
  t, stats, customers, statusData, ownerData, entryPhaseValue,
  selectedStatus, setSelectedStatus, selectedPhase, setSelectedPhase, selectedOwner, setSelectedOwner,
  kpiFilter, toggleKpi,
}: Args): { donuts: DonutSpec[]; kpis: KpiSpec[] } {
  // Server-wide totals first; the loaded page is only the honest fallback.
  // TOTALS-NESTING-1: the real counts live under stats.totals (see file docblock).
  const totalLocations   = stats?.totals?.locations       ?? customers.reduce((s, c) => s + c.locationsCount, 0)
  const totalDepartments = stats?.totals?.departments     ?? customers.reduce((s, c) => s + c.departmentsCount, 0)
  const totalContacts    = stats?.totals?.contacts        ?? customers.reduce((s, c) => s + c.contactsCount, 0)
  const totalOpenVac     = stats?.totals?.open_vacancies  ?? customers.reduce((s, c) => s + c.openVacanciesCount, 0)
  const totalActive      = stats?.totals?.active_matches  ?? customers.reduce((s, c) => s + c.activeMatchesCount, 0)
  const noContactCount   = stats?.totals?.without_contact ?? customers.filter(c => c.contactsCount === 0).length
  // KPI-RIJ-9-1 (8 → 9): open_opportunities has no per-row field to fall back
  // to — null (not a fabricated 0) while stats have not loaded yet (STATS-HONEST-1).
  const openOpportunities = stats?.totals?.open_opportunities ?? null

  const donuts: DonutSpec[] = [
    // Danny 02-08: the '__none' segment is the entry-phase (Prospect) bucket — its
    // click filters the PHASE axis, never the status axis (mirrors the candidate
    // Lead-segment click, PHASE-FILTER-1).
    { key: 'status', title: t('insights.statusTitle'), data: statusData,
      onPick: d => {
        const { axis, value } = pickCustomerStatusSegment(pickKey(d), entryPhaseValue)
        if (axis === 'phase') pickOne(setSelectedPhase)(value)
        else pickOne(setSelectedStatus)(value)
      },
      active: selectedStatus.length > 0 || selectedPhase.length > 0,
      onClear: () => { setSelectedStatus([]); setSelectedPhase([]) } },
    { key: 'am', title: t('insights.amTitle'), data: ownerData, onPick: d => pickOne(setSelectedOwner)(pickKey(d)),
      active: selectedOwner.length > 0, onClear: () => setSelectedOwner([]) },
  ]

  // KPI cards — click-to-filter, one at a time (KPI_PRED applies the row predicate).
  const kpiCard = (key: string, label: string, value: number, sub: string, color: string): KpiSpec =>
    ({ key, label, value, sub, color, onClick: () => toggleKpi(key), active: kpiFilter === key })
  const kpis: KpiSpec[] = [
    kpiCard('locations',   t('insights.locations'),     totalLocations,   t('insights.locationsSub'),     'var(--color-secondary)'),
    kpiCard('departments', t('insights.departments'),   totalDepartments, t('insights.departmentsSub'),   'var(--color-violet)'),
    // Readable primary-text token, not the raw primary, so a light brand colour stays legible.
    kpiCard('contacts',    t('insights.contacts'),      totalContacts,    t('insights.contactsSub'),      'var(--color-primary-text)'),
    kpiCard('openVac',     t('insights.openVacancies'), totalOpenVac,     t('insights.openVacanciesSub'), 'var(--color-warning)'),
    kpiCard('active',      t('insights.activeMatches'), totalActive,      t('insights.activeMatchesSub'), 'var(--color-success)'),
    kpiCard('noContact',   t('insights.noContact'),     noContactCount,   t('insights.noContactSub'),     'var(--color-danger)'),
    // KPI-RIJ-9-1 (9th card): a PLAIN count, not built via kpiCard(), because
    // there is no per-row openOpportunitiesCount to filter the loaded page by
    // (unlike the six cards above) — a click-to-filter here with no matching
    // KPI_PRED entry would filter every row out, a fake affordance (§3).
    { key: 'openOpportunities', label: t('insights.openOpportunities'), value: openOpportunities,
      sub: t('insights.openOpportunitiesSub'), color: 'var(--color-info)' },
  ]
  return { donuts, kpis }
}
