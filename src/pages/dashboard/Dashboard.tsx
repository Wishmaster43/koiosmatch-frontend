/**
 * Dashboard — the role-aware landing page: KPI cards, distribution/trend
 * charts, feed tiles and list tiles, assembled from the tenant's dashboard
 * template for the viewer's role (`viewType`, defaulting to the logged-in
 * user's own `dashboardType`). Container only — data fetching, filter state
 * and the view-model mapping each live in their own hook (§3).
 */
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useLookups } from '@/context/LookupsContext'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { useDashboardData } from './hooks/useDashboardData'
import { useDashboardFilterState } from './hooks/useDashboardFilterState'
import { apiRoleForType } from './kpiKeyMap'
import { useDashboardFilterPanel } from './hooks/useDashboardFilterPanel'
import { useDashboardViewModel } from './hooks/useDashboardViewModel'
import { KpiCard } from './DashboardPrimitives'
import { Caption } from '@/components/ui/typography'
import DistributionCharts from './blocks/DistributionCharts'
import TrendsRow from './blocks/TrendsRow'
import ShiftsSummary from './blocks/ShiftsSummary'
import ScopeBadge from './blocks/ScopeBadge'
import OppAging from './blocks/OppAging'
import FeedTileGrid from './blocks/FeedTileGrid'
import { renderedTileIds } from './blocks/feedTileKit'
import { FEED_TILES } from './blocks/feedRegistry'
import { LIST_TILES } from './blocks/lists'
import KoiosForYouCard from './KoiosForYouCard'
import KoiosPerformanceCard from './blocks/KoiosPerformanceCard'
import type { DashStats, DashOpp, DashData } from '@/types/dashboard'
import { useAllSettings, getJsonSetting, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import type { DashboardType } from './templates'
import { topGridExclude } from './templates'

// Recent lists, AI runs and conversations are now live (GET /dashboard, C-30/C-31).
// The demo placeholder arrays were removed — data is mapped by useDashboardViewModel.

export default function Dashboard({ onNavigate, viewType }: { onNavigate?: (page: string, params?: Record<string, unknown>) => void; viewType?: string }) {
  const { t } = useTranslation('dashboard')
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  // App-wide active locale (§5) — feeds the sync-sources timestamp below instead
  // of a hardcoded 'nl-NL' toLocaleString.
  const { formatDateTime } = useDateFormat()
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
  // DASH-VOLGORDE-1 (Settings → Dashboards → Volgorde) — per-role KPI tile order.
  // Same settings-blob pattern as `dashboard_hidden` above; the settings-editor
  // keeps its own literal for this key too (DASHBOARD_KPI_ORDER_KEY there).
  const kpiOrder = getJsonSetting<Record<string, string[]>>(settings, 'dashboard_kpi_order', {})
  // Planning-gated surfaces (Diensten-blok + open-diensten-KPI) only exist when the
  // tenant has the module (Danny 2026-07-04: "Planning staat uit en ik zie DIENSTEN??").
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')

  // Topbar filter selections (single-value per dimension server-side) — UI state
  // stays here; ALL server state lives in useDashboardData (audit item 21).
  const {
    selPeriode, setSelPeriode, selVestiging, setSelVestiging, selStatus, setSelStatus, dashFilterParams,
  } = useDashboardFilterState()

  // K-173 ?preview_role: a super-view user switching the dashboard to another
  // type would otherwise get the server row of their OWN role (Danny saw three
  // 'default'-row tiles under the Management switcher). Gated on settings.update
  // — the same gate the server applies; without it the viewmodel simply falls
  // back to the switched type's template row instead.
  const viewerType = auth?.dashboardType?.() ?? null
  const previewRole = viewType && viewerType && apiRoleForType(viewType) !== apiRoleForType(viewerType)
    && auth?.hasPermission?.('settings.update')
    ? apiRoleForType(viewType) : null
  const dashParams = previewRole ? { ...dashFilterParams, preview_role: previewRole } : dashFilterParams

  // Live distributions/counts. /candidates/stats is live; /opportunities/stats
  // is best-effort (renders only if it returns). Defensive field readers mirror
  // the Candidates page (by_status→status, by_funnel→funnel_type, by_owner→owner_id).
  // `loading`/`error` cover the two CRITICAL feeds (/candidates/stats + /dashboard) —
  // a failure there must render an explicit error notice, never a KPI strip full of
  // "—" that reads as real zeros (audit finding).
  const { stats, opp, dash, dashCharts, loading, error, retry } =
    useDashboardData<DashStats, DashOpp, DashData, { timeseries?: Record<string, unknown>; net?: unknown }>({
      tenantId: activeTenant?.id, filterParams: dashParams,
    })

  // Status/funnel labels + colours come from the tenant lookups (NL, configurable)
  // — never humanised backend slugs. Mirrors how the Candidates page renders them.
  const { statusMeta, funnelMeta, funnelTypes } = useLookups()

  // Every chart/list/KPI derived from the raw server state (§0.3 size split).
  const {
    vis, statusData, recruiterData, funnelData, oppStageData,
    recentCandidates, recentApplications, recentLeads, runs, conversations,
    trendData, trendSeries, shifts, kpis, scope = null,
    expiringMatchesRows, staleVacanciesRows, koiosSuggestionsRows,
    oppAgingRows = [],
  } = useDashboardViewModel({
    t, formatNumber, stats, opp, dash, dashCharts, statusMeta, funnelMeta, funnelTypes,
    activeType, hiddenBlocks, hiddenKpis, kpiOrder, hasPlanning, valueInHours,
    onNavigate,
  })

  // DASH-PAIRS-1: the recent lists + KD11 widgets are registry tiles too; the
  // viewmodel-mapped rows reach them through the tile context, and a list a pair
  // in the top grid already shows is not repeated in the bottom grid.
  const lists = { recentCandidates, recentApplications, recentLeads, runs, conversations, expiringMatchesRows, staleVacanciesRows, koiosSuggestionsRows }
  // DASHBOARD-MGMT-1 — management/recruitment_manager pull "Leads in pipeline" out
  // of the top pipeline-value pair so it lands in the bottom recent-lists row
  // instead (where "Recente uitvoeringen" sat); both grids below must agree on
  // the exclusion or the top pair swallows it into topTileIds and it renders nowhere.
  const topExclude = new Set(topGridExclude(activeType))
  const topTileIds = renderedTileIds(FEED_TILES, dash ?? ({} as DashData), vis, { onNavigate, hasPlanning, lists }, topExclude)

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
                <Caption key={s.system} as="span">
                  {t('lastSync', { source: s.label })}: {s.last_synced_at
                    ? formatDateTime(s.last_synced_at)
                    : t('neverSynced')}
                </Caption>
              ))}
            </div>
          )}

          {/* K-173 fase 1 — the honest scope this response was actually computed
              under ("Mijn kandidaten" / role label + unassigned-branch footnote). */}
          <ScopeBadge scope={scope} />

          {/* KPI-strip — live data */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {kpis.map(k => <KpiCard key={k.label} {...k} />)}
          </div>

          {/* DASH-FEEDS-V3 + DASH-PAIRS-1 — every work-feed tile (the 24 v3 feeds,
              recruiter load, the pairs Danny asked for) in ONE packed grid right
              under the KPI strip: the day's work first, then Koios and the charts. */}
          <FeedTileGrid dash={dash} vis={vis} onNavigate={onNavigate} hasPlanning={hasPlanning} lists={lists} exclude={topExclude} />

          {/* K-173 fase 6 — sales_manager/accountmanager opportunity-ageing buckets. */}
          {vis('block.oppAging') && <OppAging rows={oppAgingRows} />}

          {/* DASH-V3-UITROL-1 (K-181) — tenant-wide "Koios AI performance", only for
              management/admin (their '*' template lets any block id through). */}
          {/* Tenant-wide Koios performance is a MANAGEMENT surface (plan v3);
              recruitment_manager's '*' template must not inherit it — that role
              gets "Koios deed dit voor jou" with the team scope instead. */}
          {/* DASHBOARD-MGMT-1 (Danny 23-08): on the management/admin view, "Koios AI
              performance" (left) and "Koios did this for you" (right) sit side by
              side — other roles keep KoiosForYouCard full-width, unpaired. */}
          {vis('block.koiosPerformance') && (activeType === 'admin' || activeType === 'management') ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
              <KoiosPerformanceCard />
              {/* activeType is narrowed to admin/management here, neither of which uses the scope toggle. */}
              <KoiosForYouCard scopeToggle={false} />
            </div>
          ) : (
            /* "Koios deed dit voor jou" (K0-D noordster) — self-contained card, own
               loading/error/empty/success handling; fetches its own 7/30-day report. */
            <KoiosForYouCard scopeToggle={activeType === 'recruitment_manager' || activeType === 'sales_manager'} />
          )}

          <DistributionCharts vis={vis} statusData={statusData} funnelData={funnelData} recruiterData={recruiterData} oppStageData={oppStageData} opp={opp} onNavigate={onNavigate} />

          <TrendsRow vis={vis} trendData={trendData} trendSeries={trendSeries} funnelData={funnelData} onNavigate={onNavigate} />

          {/* Planning-blokken — WhatsApp-wachtrij (🟢) + diensten-overzicht (🟡 tot de feed). */}
          {vis('block.shifts') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {vis('block.shifts') && <ShiftsSummary open={shifts.open} occupancy={shifts.occupancy} onOpen={() => onNavigate?.('planning')} />}
          </div>
          )}

          {/* The recent lists + KD11 widgets, one packed grid (DASH-FEEDS-PACK-1 /
              DASHBOARD-OPRUIMING-1): "Werk af", "Stilstaande leads" and "Vandaag"
              stay removed; a list a pair above already shows is not repeated. */}
          <FeedTileGrid dash={dash} vis={vis} onNavigate={onNavigate} hasPlanning={hasPlanning} entries={LIST_TILES} lists={lists} exclude={topTileIds} />
        </>
      )}
    </div>
  )
}
