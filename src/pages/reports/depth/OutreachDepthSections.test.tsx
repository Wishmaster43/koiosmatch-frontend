/**
 * OutreachDepthSections — pins render-from-fixture, drill-callback contract,
 * fixture-parity for the channel/heatmap/campaign depth sections, and that a
 * section stays absent when its optional field is undefined.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import OutreachDepthSections from './OutreachDepthSections'
import type { OutreachReportData } from '@/types/analytics'

// recharts needs real layout; only the bar click wiring is under test here.
vi.mock('recharts', () => ({
  // Also surfaces the chart's mapped `data` array as JSON so a test can
  // inspect the ChartDatum name/key fields recharts itself would consume,
  // without relying on XAxis/Legend/Tooltip (all no-op mocks below).
  ComposedChart: ({ children, data }: { children?: React.ReactNode; data?: unknown }) => (
    <div>
      <div data-testid="composed-chart-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  ),
  Bar: (props: Record<string, unknown>) => (
    <button data-testid={`bar-${props.dataKey as string}`}
      onClick={() => (props.onClick as (row: unknown) => void)?.({ key: 'call', total: 12, name: 'Call' })}>
      bar
    </button>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

const renderWith = (data: OutreachReportData, onChannel = vi.fn()) => {
  const utils = render(
    <I18nextProvider i18n={i18n}>
      <OutreachDepthSections data={data} onChannel={onChannel} />
    </I18nextProvider>,
  )
  return { ...utils, onChannel }
}

// Exact server shape from the brief (channel_funnel/best_contact_heatmap/campaign_timeseries).
const fullData: OutreachReportData = {
  period: 'month', from: '2026-05-14', to: '2026-08-14',
  total_targets: 40, reached: 25, reach_rate: 0.63, total: 40,
  timeseries: { bucket: 'week', series: [] },
  by_status: [], by_outcome: [], by_campaign: [], by_assignee: [], by_channel: [],
  channel_funnel: [
    { channel: 'call', total: 12, reached: 8, applied: 3, placed: 1 },
    { channel: 'email', total: 5, reached: 2, applied: 0, placed: 0 },
  ],
  best_contact_heatmap: [
    { weekday: 1, part: 'ochtend', attempts: 4, reached: 3, rate: 75 },
    { weekday: 3, part: 'avond', attempts: 2, reached: 1, rate: 50 },
  ],
  campaign_timeseries: [
    { campaign_id: 'c1', name: 'Spring drive', series: [{ date: '2026-05-14', count: 3 }, { date: '2026-05-15', count: 5 }] },
    { campaign_id: 'c2', name: 'Summer push', series: [{ date: '2026-05-15', count: 2 }] },
  ],
}

describe('OutreachDepthSections', () => {
  it('renders each section from the fixture', () => {
    renderWith(fullData)
    expect(screen.getByText(i18n.t('outreach.depth.channelFunnel.title', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('outreach.depth.heatmap.title', { ns: 'analytics' }))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('outreach.depth.campaignSeries.title', { ns: 'analytics' }))).toBeInTheDocument()
    // Heatmap chronological columns: morning, afternoon, evening — never the
    // server's alphabetical avond/middag/ochtend order.
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent)
    expect(headers).toEqual([
      i18n.t('outreach.depth.heatmap.weekday', { ns: 'analytics' }),
      i18n.t('outreach.depth.heatmap.part.morning', { ns: 'analytics' }),
      i18n.t('outreach.depth.heatmap.part.afternoon', { ns: 'analytics' }),
      i18n.t('outreach.depth.heatmap.part.evening', { ns: 'analytics' }),
    ])
    // Row names must be the ISO weekday (1=Monday..7=Sunday), pinned via a
    // UTC-anchored formatter — the exact case that shifted by one day in a
    // negative-UTC-offset viewer when the formatter had no timeZone.
    const mondayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1)))
    const sundayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7)))
    expect(screen.getByText(mondayName)).toBeInTheDocument()
    expect(screen.getByText(sundayName)).toBeInTheDocument()
    // Rendered rate is the percent VALUE as-is (server field is already a
    // percentage, never a 0..1 ratio) — freezes the unit against regression.
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('invokes onChannel with the exact channel + total on a total-series bar click', async () => {
    const user = userEvent.setup()
    const { onChannel } = renderWith(fullData)
    await user.click(screen.getByTestId('bar-total'))
    expect(onChannel).toHaveBeenCalledWith('call', 12)
  })

  it('does not invoke onChannel for non-total series bars (inert)', async () => {
    const user = userEvent.setup()
    const { onChannel } = renderWith(fullData)
    await user.click(screen.getByTestId('bar-reached'))
    await user.click(screen.getByTestId('bar-applied'))
    await user.click(screen.getByTestId('bar-placed'))
    expect(onChannel).not.toHaveBeenCalled()
  })

  it('drops the bar click affordance entirely when no onChannel handler is passed', async () => {
    const user = userEvent.setup()
    render(
      <I18nextProvider i18n={i18n}>
        <OutreachDepthSections data={fullData} />
      </I18nextProvider>,
    )
    // No handler wired to the mock Bar means the click is a no-op; assert
    // nothing throws and no unexpected call surface exists.
    await user.click(screen.getByTestId('bar-total'))
    expect(screen.getByText(i18n.t('outreach.depth.channelFunnel.title', { ns: 'analytics' }))).toBeInTheDocument()
  })

  it('gives the lone surviving half card span 2 to avoid a grid hole', () => {
    const oneHalf: OutreachReportData = { ...fullData, best_contact_heatmap: undefined }
    renderWith(oneHalf)
    // ReportChartCard forwards span via ReportGridItem's inline gridColumn
    // style — a lone half card must carry the same '1 / -1' full-row span a
    // briefed span={2} card gets, or it leaves a hole before the campaign card.
    const title = screen.getByText(i18n.t('outreach.depth.channelFunnel.title', { ns: 'analytics' }))
    const gridItem = title.closest('[style*="grid-column"]')
    expect(gridItem).toBeTruthy()
    expect(gridItem).toHaveStyle({ gridColumn: '1 / -1' })
    expect(screen.queryByText(i18n.t('outreach.depth.heatmap.title', { ns: 'analytics' }))).not.toBeInTheDocument()
  })

  it('a missing cell shows the house dash with a no-data title', () => {
    renderWith(fullData)
    const dash = screen.getAllByText('—').find(el => el.title === i18n.t('outreach.depth.heatmap.noData', { ns: 'analytics' }))
    expect(dash).toBeTruthy()
  })

  it('sections stay absent when their optional field is undefined', () => {
    const empty: OutreachReportData = { ...fullData, channel_funnel: undefined, best_contact_heatmap: undefined, campaign_timeseries: undefined }
    renderWith(empty)
    expect(screen.queryByText(i18n.t('outreach.depth.channelFunnel.title', { ns: 'analytics' }))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('outreach.depth.heatmap.title', { ns: 'analytics' }))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('outreach.depth.campaignSeries.title', { ns: 'analytics' }))).not.toBeInTheDocument()
  })

  it('sections stay absent when their optional field is an empty array', () => {
    const empty: OutreachReportData = { ...fullData, channel_funnel: [], best_contact_heatmap: [], campaign_timeseries: [] }
    renderWith(empty)
    expect(screen.queryByText(i18n.t('outreach.depth.channelFunnel.title', { ns: 'analytics' }))).not.toBeInTheDocument()
  })

  // Attempts plural: the fixture's two cells carry attempts=4 and attempts=2,
  // so both must resolve through the real i18next plural machinery
  // (attempts_one for count===1, attempts_other for count>=2) rather than
  // hardcoding a single interpolated string that would pass with either key.
  it('resolves the attempts caption through the i18next plural, not a hardcoded string', () => {
    const singular: OutreachReportData = {
      ...fullData,
      best_contact_heatmap: [{ weekday: 1, part: 'ochtend', attempts: 1, reached: 1, rate: 100 }],
    }
    renderWith(singular)
    expect(screen.getByText(i18n.t('outreach.depth.heatmap.attempts', { count: 1, ns: 'analytics' }))).toBeInTheDocument()
    expect(i18n.t('outreach.depth.heatmap.attempts', { count: 1, ns: 'analytics' }))
      .not.toBe(i18n.t('outreach.depth.heatmap.attempts', { count: 2, ns: 'analytics' }))
  })

  it('renders the plural attempts caption for a multi-attempt cell (4)', () => {
    renderWith(fullData)
    expect(screen.getByText(i18n.t('outreach.depth.heatmap.attempts', { count: 4, ns: 'analytics' }))).toBeInTheDocument()
  })

  // Unknown channel value: the funnel label falls back to the raw channel
  // string via defaultValue, never a bare untranslated i18n key.
  it('falls back to the raw channel value for an unrecognised channel', () => {
    // Cast: the server type is a closed union, but a real backend can still
    // send a channel value the frontend enum has not caught up with yet.
    const unknownChannel = {
      ...fullData,
      channel_funnel: [{ channel: 'carrier_pigeon', total: 3, reached: 1, applied: 0, placed: 0 }],
    } as unknown as OutreachReportData
    renderWith(unknownChannel)
    // Only the channel funnel chart (first ComposedChart) carries channel names.
    const chartData = JSON.parse(screen.getAllByTestId('composed-chart-data')[0].textContent || '[]')
    expect(chartData[0].name).toBe('carrier_pigeon')
    expect(chartData[0].name).not.toBe('outreach.depth.channel.carrier_pigeon')
  })

  // A missing heatmap cell must announce itself to assistive tech via visible
  // sr-only text, not only the hover-only title attribute.
  it('gives a missing heatmap cell sr-only text in addition to its title', () => {
    renderWith(fullData)
    const noDataLabel = i18n.t('outreach.depth.heatmap.noData', { ns: 'analytics' })
    const srSpans = screen.getAllByText(noDataLabel).filter(el => el.className.includes('sr-only'))
    expect(srSpans.length).toBeGreaterThan(0)
  })
})
