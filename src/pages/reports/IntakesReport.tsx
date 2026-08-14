/**
 * IntakesReport — intake appointments over time (GET /reports/intakes, C-22).
 *
 * The shared period control drives the endpoint's `bucket` (day/week/month). Shows
 * the total, the intake time series, and a switchable breakdown (recruiter/location/
 * source/function/region). Pure presentation; data lives in useIntakesReport. The
 * endpoint is gated `candidates.view` server-side.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import SegmentBars from './SegmentBars'
import type { SegmentBarItem } from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useIntakesReport } from './useIntakesReport'
import type { ReportPeriod, IntakeBucket } from '@/types/analytics'

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
// No drill exists yet (reportDrillGate.intakes=false), so no onPick is wired.
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

  // Nine honest cards: total + distinct-category counts off every breakdown axis
  // + the top segment per dimension (label/count straight from the response). No
  // drill endpoint exists for intakes yet, so every card here stays a plain stat.
  const topOf = (items: IntakeBucket[]) =>
    items.reduce<IntakeBucket | null>((best, x) => (!best || x.count > best.count ? x : best), null)
  const topRecruiter = data ? topOf(data.by_recruiter) : null
  const topSource    = data ? topOf(data.by_source) : null
  const topFunction  = data ? topOf(data.by_function) : null
  const kpis: KpiSpec[] = [
    { key: 'total', label: t('intakes.total'), value: total },
    { key: 'recruitersCount', label: t('intakes.summary.recruitersCount'), value: data?.by_recruiter.length ?? 0 },
    { key: 'locationsCount', label: t('intakes.summary.locationsCount'), value: data?.by_location.length ?? 0 },
    { key: 'sourcesCount', label: t('intakes.summary.sourcesCount'), value: data?.by_source.length ?? 0 },
    { key: 'functionsCount', label: t('intakes.summary.functionsCount'), value: data?.by_function.length ?? 0 },
    { key: 'regionsCount', label: t('intakes.summary.regionsCount'), value: data?.by_region.length ?? 0 },
    { key: 'topRecruiter', label: t('intakes.summary.topRecruiter'), value: topRecruiter?.count ?? '—', sub: topRecruiter?.label },
    { key: 'topSource', label: t('intakes.summary.topSource'), value: topSource?.count ?? '—', sub: topSource?.label },
    { key: 'topFunction', label: t('intakes.summary.topFunction'), value: topFunction?.count ?? '—', sub: topFunction?.label },
  ]

  return (
    <div>
      {/* KPI strip — total intakes, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} />
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
                      <button key={g} type="button" onClick={() => setGroup(g)}
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
              <SegmentBars items={toSegments(breakdown)}
                max={breakdown.reduce((m, i) => Math.max(m, i.count), 0)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
