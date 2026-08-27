import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReportChartCard from '../ReportChartCard'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import type { BarSeries } from '@/components/charts/WeeklyBarChartCard'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { Caption } from '@/components/ui/typography'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import type { OutreachReportData } from '@/types/analytics'

// Chronological order for the heatmap columns — the server sorts its rows
// alphabetically (avond < middag < ochtend), never trust that order on render.
// The slug itself is a WIRE value (OutreachReportData['best_contact_heatmap'][].part) —
// kept in the server's Dutch spelling here; only the FE-facing i18n key is English,
// via DAYPART_I18N_KEY below (ID-ENGELS-1: rename at the FE boundary, not the contract).
const HEATMAP_PARTS = ['ochtend', 'middag', 'avond'] as const
const DAYPART_I18N_KEY: Record<typeof HEATMAP_PARTS[number], string> = {
  ochtend: 'morning', middag: 'afternoon', avond: 'evening',
}

// A Monday-anchored reference date so Intl gives us the tenant-locale weekday
// short name for ISO weekday 1..7 without touching any real report data.
const MONDAY_ANCHOR = new Date(Date.UTC(2024, 0, 1)) // 2024-01-01 is a Monday

/**
 * OutreachDepthSections — the three DASH-FEEDS-V3 depth sections for the
 * Outreach report: a channel funnel bar chart, a best-contact-moment heatmap
 * table, and a per-campaign daily timeseries. Each section self-hides when its
 * optional server field is absent (the compare envelope never carries these).
 * Rendered as a bare fragment of ReportChartCard cells — the page owns the grid
 * and the odd-card span.
 */
export default function OutreachDepthSections({ data, onChannel }: {
  data: OutreachReportData
  // Fired for a total-series bar click; the page maps it onto its existing
  // channel drill (pickSegment('channel', …)). Optional: when the page's
  // drill capability is gated off, no handler is passed and the bar chart
  // must render with NO click affordance at all (never a swallowed no-op).
  onChannel?: (channel: string, total: number) => void
}) {
  const { t, i18n } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatPercent } = useNumberFormat()

  // ODD-CARD RULE for these two half cards: when both self-hide or both
  // render, parity stays even (the page already accounts for that). When
  // exactly ONE of the two survives, that lone half must take span 2 itself
  // or it leaves a hole before the span-2 campaign card that follows it.
  const hasChannelFunnel = !!data.channel_funnel && data.channel_funnel.length > 0
  const hasHeatmap = !!data.best_contact_heatmap && data.best_contact_heatmap.length > 0
  const loneHalfSpan = hasChannelFunnel !== hasHeatmap ? 2 : undefined

  return (
    <Fragment>
      {/* 1. Channel funnel — targeted/reached/applied/placed per channel. Only
          the `total` series is clickable (drills the channel axis); the other
          series are informative, not their own drill dimension. */}
      {hasChannelFunnel && (
        <ReportChartCard span={loneHalfSpan} title={t('outreach.depth.channelFunnel.title')} chart={
          <WeeklyBarChartCard
            data={data.channel_funnel!.map((c): ChartDatum => ({
              // Unknown channel value: fall back to the raw channel string
              // rather than rendering a bare untranslated i18n key.
              name: t(`outreach.depth.channel.${c.channel}`, { defaultValue: c.channel }), key: c.channel,
              value: c.total, total: c.total, reached: c.reached, applied: c.applied, placed: c.placed,
            }))}
            series={[
              { key: 'total', label: t('outreach.depth.channelFunnel.total'), color: 'var(--color-primary)' },
              { key: 'reached', label: t('outreach.depth.channelFunnel.reached'), color: 'var(--color-secondary)' },
              { key: 'applied', label: t('outreach.depth.channelFunnel.applied'), color: 'var(--color-warning-text)' },
              { key: 'placed', label: t('outreach.depth.channelFunnel.placed'), color: 'var(--color-success-text)' },
            ] satisfies BarSeries[]}
            // Undefined (not a no-op) when no handler was passed, so the chart
            // atom itself drops the pointer cursor on every bar (§3 no fake
            // affordance) instead of showing a clickable surface that swallows.
            onBarClick={onChannel ? (row, series) => {
              if (series.key !== 'total') return
              const bar = row as { key?: string; total?: number }
              if (bar.key != null && bar.total != null) onChannel(bar.key, bar.total)
            } : undefined}
          />
        } />
      )}

      {/* 2. Best-contact heatmap — sparse cells (attempts>0 only), rendered as a
          weekday × daypart table. Inert: no navigable target exists for a rate. */}
      {hasHeatmap && (
        <ReportChartCard span={loneHalfSpan} title={t('outreach.depth.heatmap.title')} chart={
          <HeatmapTable cells={data.best_contact_heatmap!} t={t} i18n={i18n} formatPercent={formatPercent} />
        } />
      )}

      {/* 3. Campaign timeseries — top-5 campaigns, one daily count line each,
          full-width. Inert: informative trend only, no drill target. */}
      {data.campaign_timeseries && data.campaign_timeseries.length > 0 && (
        <ReportChartCard span={2} title={t('outreach.depth.campaignSeries.title')} chart={
          <CampaignTimeseriesChart campaigns={data.campaign_timeseries} formatDate={formatDate} />
        } />
      )}
    </Fragment>
  )
}

// Weekday × daypart pivot table — 7 rows fixed (1..7), 3 columns in the fixed
// chronological order (morning/afternoon/evening), never the server's own sort.
function HeatmapTable({ cells, t, i18n, formatPercent }: {
  cells: NonNullable<OutreachReportData['best_contact_heatmap']>
  t: (key: string, opts?: Record<string, unknown>) => string
  i18n: { language: string }
  formatPercent: (v: number) => string
}) {
  const byKey = new Map(cells.map(c => [`${c.weekday}-${c.part}`, c]))
  // UTC pin is required: the anchor is a UTC-midnight instant, and without
  // timeZone Intl reads it back in the viewer's LOCAL zone — in any negative
  // UTC offset that rolls every weekday name back by one day (reproduced in
  // America/New_York: server weekday=1/Monday renders as 'Sunday').
  // Memoised on the active language: constructing an Intl formatter is not
  // free, and this table re-renders on every drill/filter change.
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }),
    [i18n.language],
  )
  const rows = Array.from({ length: 7 }, (_, i) => {
    const weekday = i + 1
    const dayDate = new Date(MONDAY_ANCHOR)
    dayDate.setUTCDate(dayDate.getUTCDate() + i)
    return { weekday, name: weekdayFormatter.format(dayDate) }
  })
  const columns: Column<{ weekday: number; name: string }>[] = [
    { key: 'weekday', header: t('outreach.depth.heatmap.weekday'), render: r => r.name, nowrap: true },
    ...HEATMAP_PARTS.map((part): Column<{ weekday: number; name: string }> => ({
      key: part, header: t(`outreach.depth.heatmap.part.${DAYPART_I18N_KEY[part]}`), align: 'center',
      render: r => {
        const cell = byKey.get(`${r.weekday}-${part}`)
        if (!cell) return (
          <span title={t('outreach.depth.heatmap.noData')}>
            —<span className="sr-only">{t('outreach.depth.heatmap.noData')}</span>
          </span>
        )
        return (
          <div>
            <div>{formatPercent(cell.rate)}</div>
            <Caption>{t('outreach.depth.heatmap.attempts', { count: cell.attempts })}</Caption>
          </div>
        )
      },
    })),
  ]
  return <DataTable columns={columns} rows={rows} getRowId={r => r.weekday} emptyText={t('outreach.depth.heatmap.noData')} />
}

// Union of every campaign's dates → one row per date, one numeric column per
// campaign (each drawn as a line series).
function CampaignTimeseriesChart({ campaigns, formatDate }: {
  campaigns: NonNullable<OutreachReportData['campaign_timeseries']>
  formatDate: (v: string, opts?: Intl.DateTimeFormatOptions) => string
}) {
  const dateSet = new Set<string>()
  campaigns.forEach(c => c.series.forEach(p => dateSet.add(p.date)))
  const dates = Array.from(dateSet).sort()
  // Briefed as DD-MM (no year): a 90-day period would otherwise carry ~90
  // ten-character DD-MM-YYYY labels on the x-axis.
  const data: ChartDatum[] = dates.map(date => {
    const row: ChartDatum = { name: formatDate(date, { day: '2-digit', month: '2-digit' }), key: date, value: 0 }
    campaigns.forEach(c => {
      const pt = c.series.find(p => p.date === date)
      row[c.campaign_id] = pt?.count ?? 0
    })
    return row
  })
  const series: BarSeries[] = campaigns.map((c, i) => ({
    key: c.campaign_id, label: c.name, color: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length], line: true,
  }))
  return <WeeklyBarChartCard data={data} series={series} />
}
