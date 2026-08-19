import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useCandidateCount } from '@/lib/queries'
import { useLookups } from '@/context/LookupsContext'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { useDashboardData } from './hooks/useDashboardData'
import { useDashboardFilterState } from './hooks/useDashboardFilterState'
import { useDashboardFilterPanel } from './hooks/useDashboardFilterPanel'
import { useDashboardViewModel } from './hooks/useDashboardViewModel'
import { KpiCard } from './DashboardPrimitives'
import DistributionCharts from './blocks/DistributionCharts'
import TrendsRow from './blocks/TrendsRow'
import RecentListsRow from './blocks/RecentListsRow'
import ActivityListsRow from './blocks/ActivityListsRow'
import ShiftsSummary from './blocks/ShiftsSummary'
import TouchpointsFeed from './blocks/TouchpointsFeed'
import AttentionCandidates from './blocks/AttentionCandidates'
import WidgetListBlock from './blocks/WidgetListBlock'
import KoiosForYouCard from './KoiosForYouCard'
import type { DashStats, DashOpp, DashData, DashAppStats, DashVacStats } from '@/types/dashboard'
import { useAllSettings, getJsonSetting, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import type { DashboardType } from './templates'

// Recent lists, AI runs and conversations are now live (GET /dashboard, C-30/C-31).
// The demo placeholder arrays were removed — data is mapped by useDashboardViewModel.

export default function Dashboard({ onNavigate, viewType }: { onNavigate?: (page: string, params?: Record<string, unknown>) => void; viewType?: string }) {
  const { t } = useTranslation('dashboard')
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  // App-wide active locale (§5) — feeds the sync-sources timestamp below instead
  // of a hardcoded 'nl-NL' toLocaleString.
  const { formatDate } = useDateFormat()
  const auth = useAuth()
  const { activeTenant } = auth ?? {}
  // The active view/type is chosen in the topbar switcher (DashboardLayout); fall
  // back to the user's own type if rendered standalone. management/'*' = full view.
  const activeType = (viewType ?? auth?.dashboardType?.() ?? 'readonly') as DashboardType
  // Tenant per-role toggles (Settings → Dashboards): a block/KPI is shown if the template
  // allows it AND it is not switched off for this role. Live via the shared settings store.
  const settings = useAllSettings()
  // Deal magnitude in hours instead of euro (Settings → Opportunities → display) — the
  // pipeline KPI must follow the same tenant rule as the opportunities page.
  const valueInHours = getBoolSetting(settings, 'opportunity_value_in_hours', false)
  const hidden = getJsonSetting<Record<string, { kpis?: string[]; blocks?: string[] }>>(settings, 'dashboard_hidden', {})
  const hiddenBlocks = hidden[activeType]?.blocks ?? []
  const hiddenKpis = hidden[activeType]?.kpis ?? []
  // Planning-gated surfaces (Diensten-blok + open-diensten-KPI) only exist when the
  // tenant has the module (Danny 2026-07-04: "Planning staat uit en ik zie DIENSTEN??").
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')

  // Live total — same source as the Candidates table (/candidates meta.total).
  const { data: candidateTotal, isLoading: countLoading } = useCandidateCount()
  const candidateTotalLabel = countLoading ? '…' : formatNumber(candidateTotal ?? 0)

  // Topbar filter selections (single-value per dimension server-side) — UI state
  // stays here; ALL server state lives in useDashboardData (audit item 21).
  const {
    selPeriode, setSelPeriode, selVestiging, setSelVestiging, selStatus, setSelStatus, dashFilterParams,
  } = useDashboardFilterState()

  // Live distributions/counts. /candidates/stats is live; /opportunities/stats
  // is best-effort (renders only if it returns). Defensive field readers mirror
  // the Candidates page (by_status→status, by_funnel→funnel_type, by_owner→owner_id).
  // `loading`/`error` cover the two CRITICAL feeds (/candidates/stats + /dashboard) —
  // a failure there must render an explicit error notice, never a KPI strip full of
  // "—" that reads as real zeros (audit finding).
  const { stats, opp, dash, dashCharts, matchesTotal, vacanciesTotal, appStats, vacStats, loading, error, retry } =
    useDashboardData<DashStats, DashOpp, DashData, { timeseries?: Record<string, unknown>; net?: unknown }, DashAppStats, DashVacStats>({
      tenantId: activeTenant?.id, filterParams: dashFilterParams,
    })

  // Status/funnel labels + colours come from the tenant lookups (NL, configurable)
  // — never humanised backend slugs. Mirrors how the Candidates page renders them.
  const { statusMeta, funnelMeta, funnelTypes } = useLookups()

  // Every chart/list/KPI derived from the raw server state (§0.3 size split).
  const {
    vis, statusData, recruiterData, funnelData, oppStageData,
    recentCandidates, recentApplications, recentLeads, runs, conversations,
    showRuns, showConv, trendData, trendSeries, att, kpis,
    expiringMatchesRows, staleLeadsRows, staleVacanciesRows, koiosSuggestionsRows, customersByOwnerRows,
  } = useDashboardViewModel({
    t, formatNumber, stats, opp, dash, dashCharts, statusMeta, funnelMeta, funnelTypes,
    activeType, hiddenBlocks, hiddenKpis, hasPlanning, valueInHours, candidateTotalLabel,
    matchesTotal, vacanciesTotal, appStats, vacStats, onNavigate,
  })

  // Registers this page's right-panel filter groups (period/location/status options).
  useDashboardFilterPanel({
    dash, t, selPeriode, setSelPeriode, selVestiging, setSelVestiging, selStatus, setSelStatus,
  })

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* Loading state (§3: the four UI states) — the two critical feeds are still
          in flight. Shown instead of the KPI strip so a slow load never flashes
          "—" values that could be mistaken for real zeros. */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: '96px 0', color: 'var(--text-muted)' }}>
          <Spinner size={22} />
          <span style={{ fontSize: 13 }}>{t('page.loading')}</span>
        </div>
      )}

      {/* Error state — /candidates/stats or /dashboard failed. A calm banner + retry,
          never a dashboard rendered with fake-looking "—" KPIs (audit finding). */}
      {!loading && error && (
        <ErrorBanner style={{ marginBottom: 16 }} onRetry={retry}>{t('page.loadError')}</ErrorBanner>
      )}

      {/* Success state — the live dashboard. (No distinct "empty" state: a tenant
          with zero candidates/vacancies is a legitimate all-zero dashboard, not a
          missing-data case — that distinction is exactly what the error state above
          now makes explicit.) */}
      {!loading && !error && (
        <>
          {/* Bron-versheid — Shiftmanager heeft z'n eigen "Laatste sync" op het SM-dashboard,
              dus hier alleen de overige koppelingen (intus/sdb). Datum in nl-NL (24u). */}
          {(dash?.sync_sources ?? []).filter(s => s.system !== 'shiftmanager').length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
              {(dash?.sync_sources ?? []).filter(s => s.system !== 'shiftmanager').map(s => (
                <span key={s.system} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('lastSync', { source: s.label })}: {s.last_synced_at
                    ? formatDate(s.last_synced_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : t('neverSynced')}
                </span>
              ))}
            </div>
          )}

          {/* KPI-strip — live data */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {kpis.map(k => <KpiCard key={k.label} {...k} />)}
          </div>

          {/* "Koios deed dit voor jou" (K0-D noordster) — self-contained card, own
              loading/error/empty/success handling; fetches its own 7/30-day report. */}
          <KoiosForYouCard />

          <DistributionCharts vis={vis} statusData={statusData} funnelData={funnelData} recruiterData={recruiterData} oppStageData={oppStageData} opp={opp} onNavigate={onNavigate} />

          <TrendsRow vis={vis} trendData={trendData} trendSeries={trendSeries} funnelData={funnelData} onNavigate={onNavigate} />

          {/* ONE grid for every work-feed tile (DASH-FEEDS-PACK-1, Danny 17-08:
              "Stilstaande leads naast Werk af").
              These used to be TWO grids with a hardcoded '1fr 1fr' and other
              sections between them. Each tile self-hides when its data is empty
              (all of them `return null`), so whenever a neighbour hid itself its
              half of the row stayed blank — which is what Danny saw: "Werk af"
              alone in one row and "Stilstaande leads" alone two sections lower,
              with dead space beside both. In one grid the cells simply pack.
              ORDER: the two work-lists lead, because both answer "what must I
              pick up now?" — so they land side by side in row one no matter how
              many of the tiles below them have data. "Vandaag" (today's contact
              moments) is a different question and follows them. */}
          {(vis('block.touchpoints') || vis('block.attention') || vis('block.expiringMatches')
            || vis('block.staleLeads') || vis('block.staleVacancies') || vis('block.koiosSuggestions')) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {vis('block.attention') && <AttentionCandidates groups={dash?.attention_candidates} onOpen={(id) => onNavigate?.('candidates', { open: id })} onNavigate={onNavigate} />}
            {vis('block.staleLeads') && <WidgetListBlock title={t('block.staleLeads')} rows={staleLeadsRows} />}
            {vis('block.touchpoints') && <TouchpointsFeed items={dash?.touchpoints ?? []} onOpen={(id) => onNavigate?.('candidates', { open: id })} />}
            {vis('block.expiringMatches') && <WidgetListBlock title={t('block.expiringMatches')} rows={expiringMatchesRows} />}
            {vis('block.staleVacancies') && <WidgetListBlock title={t('block.staleVacancies')} rows={staleVacanciesRows} />}
            {vis('block.koiosSuggestions') && <WidgetListBlock title={t('block.koiosSuggestions')} rows={koiosSuggestionsRows} />}
          </div>
          )}

          {/* Planning-blokken — WhatsApp-wachtrij (🟢) + diensten-overzicht (🟡 tot de feed). */}
          {vis('block.shifts') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {vis('block.shifts') && <ShiftsSummary open={att.open_shifts} filled={att.filled_shifts} unfilled={att.unfilled_shifts} occupancy={att.occupancy} onOpen={() => onNavigate?.('planning')} />}
          </div>
          )}

          {/* KD11 (DASHP36) — the four sales-widget feeds moved INTO the packed
              grid above (DASH-FEEDS-PACK-1); only the full-width tenant-wide
              breakdown stays on its own row, since it is not a half-width tile. */}
          {vis('block.customersByOwner') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
            <WidgetListBlock title={t('block.customersByOwner')} rows={customersByOwnerRows} />
          </div>
          )}

          <RecentListsRow vis={vis} recentCandidates={recentCandidates} recentApplications={recentApplications} onNavigate={onNavigate} />

          <ActivityListsRow vis={vis} showRuns={showRuns} showConv={showConv} recentLeads={recentLeads} runs={runs} conversations={conversations} onNavigate={onNavigate} />
        </>
      )}
    </div>
  )
}
