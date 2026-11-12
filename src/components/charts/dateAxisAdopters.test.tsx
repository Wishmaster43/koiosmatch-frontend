/**
 * AXIS-TICK-DATE-1 adoption — every date chart site hands the shared chart cards the ISO date
 * as category AND the `dateAxis` flag, so the card renders DD-MM ticks and a DD-MM-YYYY tooltip
 * (chartDateAxis.test covers the cards). Dropping `dateAxis` at any adopter would put a raw ISO
 * date on screen; these tests fail on that.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import type { ReactNode } from 'react'

type Props = { title?: ReactNode; data: { name: string }[]; dateAxis?: boolean }
const seen: Record<string, Props[]> = { line: [], bar: [], weekly: [] }
vi.mock('@/components/charts/LineChartCard', () => ({ default: (p: Props) => { seen.line.push(p); return null } }))
vi.mock('@/components/charts/BarChartCard', () => ({ default: (p: Props) => { seen.bar.push(p); return null } }))
vi.mock('@/components/charts/WeeklyBarChartCard', () => ({ default: (p: Props) => { seen.weekly.push(p); return null } }))
vi.mock('@/pages/reports/ReportsHubAttention', () => ({ default: () => null }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ navigate: vi.fn() }) }))

import FillRateTimeseriesLine from '@/pages/dashboard/blocks/recruiter/FillRateTimeseriesLine'
import PipelineValueLine from '@/pages/dashboard/blocks/sales/PipelineValueLine'
import ReportTimeseriesChart from '@/pages/reports/ReportTimeseriesChart'
import ReportsHubCharts from '@/pages/reports/ReportsHubCharts'
import VacancyDepthSections from '@/pages/reports/depth/VacancyDepthSections'
import OutreachDepthSections from '@/pages/reports/depth/OutreachDepthSections'
import ChannelActivityChart from '@/pages/whatsapp/ChannelActivityChart'
import type { VacanciesReportData, OutreachReportData } from '@/types/analytics'

const wrap = (ui: ReactNode) => <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
const ISO = '2026-08-24'
beforeEach(() => { seen.line = []; seen.bar = []; seen.weekly = [] })

describe('dateAxis adopters', () => {
  it('FillRateTimeseriesLine', () => {
    render(wrap(<FillRateTimeseriesLine rows={[{ date: ISO, total: 10, filled: 8, rate: 80 }]} />))
    expect(seen.line[0].data[0].name).toBe(ISO)
    expect(seen.line[0].dateAxis).toBe(true)
  })

  it('PipelineValueLine', () => {
    render(wrap(<PipelineValueLine rows={[{ date: ISO, value: 5 }]} />))
    expect(seen.line[0].data[0].name).toBe(ISO)
    expect(seen.line[0].dateAxis).toBe(true)
  })

  it('ReportTimeseriesChart ignores the BE short label and uses the date', () => {
    render(wrap(<ReportTimeseriesChart series={[{ date: ISO, label: '24 aug.', value: 3 }]} />))
    expect(seen.line[0].data[0].name).toBe(ISO)
    expect(seen.line[0].dateAxis).toBe(true)
  })

  it('ReportTimeseriesChart keeps the BE week label without dateAxis for a week bucket', () => {
    render(wrap(<ReportTimeseriesChart bucket="week" series={[{ date: ISO, label: 'wk 45', value: 3 }]} />))
    expect(seen.line[0].data[0].name).toBe('wk 45')
    expect(seen.line[0].dateAxis).toBe(false)
  })

  it('ReportTimeseriesChart uses the ISO date with dateAxis for a day bucket', () => {
    render(wrap(<ReportTimeseriesChart bucket="day" series={[{ date: ISO, label: '24 aug.', value: 3 }]} />))
    expect(seen.line[0].data[0].name).toBe(ISO)
    expect(seen.line[0].dateAxis).toBe(true)
  })

  it('ReportsHubCharts fill-rate bars', () => {
    const idle = { data: null, loading: false, error: false }
    const vacancies = { ...idle, data: { fill_rate_timeseries: [{ date: ISO, total: 4, filled: 2, rate: 50 }] } as unknown as VacanciesReportData }
    render(wrap(<ReportsHubCharts applications={idle} vacancies={vacancies} matches={idle} tasks={idle} candidates={idle} />))
    const dated = seen.bar.find(b => b.data[0]?.name === ISO)
    expect(dated?.dateAxis).toBe(true)
  })

  it('VacancyDepthSections fill-rate series', () => {
    const data = { fill_rate_timeseries: [{ date: ISO, total: 4, filled: 2, rate: 50 }] } as unknown as VacanciesReportData
    render(wrap(<VacancyDepthSections data={data} onAgingRow={vi.fn()} />))
    expect(seen.line[0].data[0].name).toBe(ISO)
    expect(seen.line[0].dateAxis).toBe(true)
  })

  it('OutreachDepthSections campaign series', () => {
    const data = { campaign_timeseries: [{ campaign_id: 'c1', name: 'Spring', series: [{ date: ISO, count: 3 }] }] } as unknown as OutreachReportData
    render(wrap(<OutreachDepthSections data={data} onChannel={vi.fn()} />))
    expect(seen.weekly[0].data[0].name).toBe(ISO)
    expect(seen.weekly[0].dateAxis).toBe(true)
  })

  it('ChannelActivityChart', () => {
    render(wrap(<ChannelActivityChart data={[{ date: ISO, inbound: 1, outbound: 1 }]} />))
    expect(seen.weekly[0].data[0].name).toBe(ISO)
    expect(seen.weekly[0].dateAxis).toBe(true)
  })
})
