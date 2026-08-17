/**
 * IntakesReport — intake appointments over time (GET /reports/intakes, C-22).
 *
 * The shared period control drives the endpoint's `bucket` (day/week/month). Shows
 * the total, the intake time series, and a switchable breakdown (recruiter/location/
 * source/function/region). Pure presentation; data lives in useIntakesReport. The
 * endpoint is gated `candidates.view` server-side.
 *
 * REPORTS-DRILL-2: the "total" KPI card and each breakdown bar drill through the
 * SAME shared mechanism every other report uses — GET /reports/intakes/drill
 * (ReportDrillController::intakes), gated candidates.view, one row per appointment
 * (date/time, candidate, recruiter, branch, status). At most one of recruiter/
 * location/source/function/region narrows the drill; the plain unnarrowed call is
 * itself a valid drill (the window-total row list, per the controller's docblock).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/formatters'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import SegmentBars from './SegmentBars'
import type { SegmentBarItem } from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useIntakesReport } from './useIntakesReport'
import { gateDrillClick } from './reportDrillGate'
import type { ReportPeriod, IntakeBucket } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// The five breakdown dimensions the endpoint returns; the selector switches between them.
const GROUPS = ['recruiter', 'location', 'source', 'function', 'region'] as const
type Group = typeof GROUPS[number]
const GROUP_KEY: Record<Group, 'by_recruiter' | 'by_location' | 'by_source' | 'by_function' | 'by_region'> = {
  recruiter: 'by_recruiter', location: 'by_location', source: 'by_source',
  function: 'by_function', region: 'by_region',
}

// Maps an IntakeBucket (no colour axis here) onto the shared SegmentBars shape.
const toSegments = (items: IntakeBucket[]): SegmentBarItem[] =>
  items.map((it, i) => ({ key: it.key ?? String(i), label: it.label, count: it.count, color: null }))

// Maps the intake date series onto the shared timeseries chart's point shape.
const toTimeseries = (items: IntakeBucket[]) =>
  items.map((it, i) => ({ date: it.key ?? String(i), label: it.label, value: it.count }))

export default function IntakesReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error, refetch } = useIntakesReport(period)
  const [group, setGroup] = useState<Group>('recruiter')

  const total     = data?.total ?? 0
  const series    = data?.series ?? []
  const breakdown = data?.[GROUP_KEY[group]] ?? []
  const hasData   = !loading && !error && total > 0

  // REPORTS-DRILL-2: one drill list per section (breakdown bars own key, the
  // timeseries owns its own) — mirrors the ApplicationsReport/VacanciesReport
  // pattern, never a single global drill. `from`/`to` stay unsent (the
  // intakes drill's window params are `sometimes` — no narrowing means the
  // report-wide unwindowed segment, itself a valid drill per the controller's
  // own docblock); the ONE segment key sent is always the exact axis param
  // (recruiter/location/source/function/region), never combined with another.
  const [breakdownDrill, setBreakdownDrill] = useState<DrillSpec | null>(null)
  const openBreakdown = (it: IntakeBucket, param: Record<string, unknown>) => setBreakdownDrill({
    title: it.label, value: it.count,
    rowsEndpoint: '/reports/intakes/drill', rowsParams: param,
  })
  const onBreakdownPick = gateDrillClick('intakes', (key: string) => {
    const it = breakdown.find((x, i) => (x.key ?? String(i)) === key)
    if (it) openBreakdown(it, { [group]: it.key ?? it.label })
  })

  // The "total" KPI card's own drill: the endpoint's zero-param unnarrowed
  // segment (intakeSegmentRules' docblock: no field is required, only mutually
  // exclusive if present — the plain windowed total IS itself a valid drill).
  const [totalDrill, setTotalDrill] = useState<DrillSpec | null>(null)
  const openTotal = () => setTotalDrill({ title: t('intakes.total'), value: total, rowsEndpoint: '/reports/intakes/drill', rowsParams: {} })

  // Nine honest cards: total (clickable, see openTotal above) + distinct-category
  // counts off every breakdown axis + the top segment per dimension (label/count
  // straight from the response). The eight non-total cards stay plain stats — no
  // single XOR drill value represents "how many distinct recruiters", only a
  // recruiter's own bar does (wired above via onBreakdownPick).
  const topOf = (items: IntakeBucket[]) =>
    items.reduce<IntakeBucket | null>((best, x) => (!best || x.count > best.count ? x : best), null)
  const topRecruiter = data ? topOf(data.by_recruiter) : null
  const topSource    = data ? topOf(data.by_source) : null
  const topFunction  = data ? topOf(data.by_function) : null
  // Spares (REPORTS-KPI-SPARES-1): the top real segment of two axes not yet
  // offered (by_location/by_region, same "biggest real value" pattern as
  // topRecruiter/topSource above), the unassigned-recruiter bucket the
  // by_recruiter axis already carries (key null, "Niet toegewezen"), and an
  // honest rate over two real counts (total / distinct recruiters) — never a
  // fabricated number.
  const topLocation = data ? topOf(data.by_location) : null
  const topRegion   = data ? topOf(data.by_region) : null
  const unassignedRecruiter = data?.by_recruiter.find(b => b.key === null) ?? null
  const recruitersCount = data?.by_recruiter.length ?? 0
  const kpiByKey: Record<string, KpiSpec> = {
    total: { key: 'total', label: t('intakes.total'), value: total, active: totalDrill != null,
      onClick: gateDrillClick('intakes', openTotal) },
    recruitersCount: { key: 'recruitersCount', label: t('intakes.summary.recruitersCount'), value: data?.by_recruiter.length ?? 0 },
    locationsCount: { key: 'locationsCount', label: t('intakes.summary.locationsCount'), value: data?.by_location.length ?? 0 },
    sourcesCount: { key: 'sourcesCount', label: t('intakes.summary.sourcesCount'), value: data?.by_source.length ?? 0 },
    functionsCount: { key: 'functionsCount', label: t('intakes.summary.functionsCount'), value: data?.by_function.length ?? 0 },
    regionsCount: { key: 'regionsCount', label: t('intakes.summary.regionsCount'), value: data?.by_region.length ?? 0 },
    topRecruiter: { key: 'topRecruiter', label: t('intakes.summary.topRecruiter'), value: topRecruiter?.count ?? '—', sub: topRecruiter?.label },
    topSource: { key: 'topSource', label: t('intakes.summary.topSource'), value: topSource?.count ?? '—', sub: topSource?.label },
    topFunction: { key: 'topFunction', label: t('intakes.summary.topFunction'), value: topFunction?.count ?? '—', sub: topFunction?.label },
    unassignedRecruiter: { key: 'unassignedRecruiter', label: t('intakes.summary.unassignedRecruiter'), value: unassignedRecruiter?.count ?? 0 },
    topLocation: { key: 'topLocation', label: t('intakes.summary.topLocation'), value: topLocation?.count ?? '—', sub: topLocation?.label },
    topRegion: { key: 'topRegion', label: t('intakes.summary.topRegion'), value: topRegion?.count ?? '—', sub: topRegion?.label },
    avgPerRecruiter: { key: 'avgPerRecruiter', label: t('intakes.summary.avgPerRecruiter'),
      value: recruitersCount > 0 ? formatNumber(total / recruitersCount) : '—' },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('intakes').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('intakes')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('intakes'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — total intakes, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('intakes.kpiOrderFellBack') : undefined} />
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('intakes.loading')} errorLabel={t('intakes.error')} emptyLabel={t('intakes.empty')}
          onRetry={() => refetch()}
        />
        {hasData && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Intakes over time */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('intakes.series')}</h3>
              <ReportTimeseriesChart series={toTimeseries(series)} />
            </section>

            {/* Switchable breakdown per dimension */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <h3 style={head}>{t('intakes.groupBy')}</h3>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {GROUPS.map(g => {
                    const on = group === g
                    return (
                      <button key={g} type="button" onClick={() => { setGroup(g); setBreakdownDrill(null) }}
                        style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 999, cursor: 'pointer',
                          fontWeight: on ? 600 : 400,
                          // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                          color: on ? 'var(--color-primary-text)' : 'var(--text-muted)',
                          background: on ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
                          border: `1px solid ${on ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'var(--border)'}`,
                        }}>
                        {t(`intakes.by.${g}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <ReportChartWithDrillList drill={breakdownDrill} placeholderLabel={t(`intakes.by.${group}`)}
                chart={<SegmentBars items={toSegments(breakdown)} onPick={onBreakdownPick}
                  max={breakdown.reduce((m, i) => Math.max(m, i.count), 0)} />} />
            </section>
          </div>
        )}
      </div>

      {/* The "total" KPI card's own drill — same shared drawer every report uses. */}
      <ReportDrillDrawer drill={totalDrill} onClose={() => setTotalDrill(null)} />
    </div>
  )
}
