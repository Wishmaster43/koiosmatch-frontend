/**
 * ChannelActivityChart — the by_channel days map onto one stacked row per day
 * with the three enum channels as series (K-197).
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ChannelActivityChart from './ChannelActivityChart'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// `@/lib/datetime` transitively imports the real i18n bootstrap (module-scope
// `i18n.use(initReactI18next)`) which throws against the flat react-i18next
// mock above (no `initReactI18next` export) — mocked here so the chart's own
// `useLocale()` call never loads the real module (LANE-B fix round).
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))
const captured = vi.fn()
vi.mock('@/components/charts/WeeklyBarChartCard', () => ({ default: (props: unknown) => { captured(props); return null } }))

describe('ChannelActivityChart (K-197)', () => {
  it('stacks the three channels per day, missing channels count as zero', () => {
    render(<ChannelActivityChart data={[
      { date: '2026-08-24', inbound: 3, outbound: 4, by_channel: { waba: { inbound: 1, outbound: 2 }, wa_web: { inbound: 2, outbound: 2 } } },
      { date: '2026-08-25', inbound: 0, outbound: 0 },
    ]} />)
    const props = captured.mock.calls[0][0] as { stacked: boolean; series: { key: string }[]; data: Record<string, unknown>[] }
    expect(props.stacked).toBe(true)
    expect(props.series.map(s => s.key)).toEqual(['waba', 'waba_coex', 'wa_web'])
    expect(props.data[0]).toMatchObject({ waba: 3, waba_coex: 0, wa_web: 4, value: 7 })
    expect(props.data[1]).toMatchObject({ waba: 0, waba_coex: 0, wa_web: 0, value: 0 })
  })
})
