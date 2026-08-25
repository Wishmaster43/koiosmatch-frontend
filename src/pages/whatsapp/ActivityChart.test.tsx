/**
 * ActivityChart — LANE-B regression: the chart renders (and its axis/tooltip
 * date formatting resolves) under the same flat react-i18next mock the other
 * WhatsApp chart tests use, without a mocked `i18n` on useTranslation().
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActivityChart from './ActivityChart'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// `@/lib/datetime` transitively imports the real i18n bootstrap (module-scope
// `i18n.use(initReactI18next)`) which throws against the flat react-i18next
// mock above (no `initReactI18next` export) — mocked here so the chart's own
// `useLocale()` call never loads the real module.
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))

describe('ActivityChart', () => {
  it('renders the chart title for a non-empty activity series', () => {
    render(<ActivityChart data={[
      { date: '2026-08-24', inbound: 3, outbound: 4 },
      { date: '2026-08-25', inbound: 1, outbound: 2 },
    ]} />)
    expect(screen.getByText('chartTitle')).toBeInTheDocument()
  })

  it('shows the loading state instead of the chart', () => {
    render(<ActivityChart data={[]} loading />)
    expect(screen.getByText('loading')).toBeInTheDocument()
  })
})
