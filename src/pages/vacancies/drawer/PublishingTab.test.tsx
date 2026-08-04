/**
 * PublishingTab — round-4 audit finding #3: the channel flags (active/default_enabled,
 * carried through by VacancyLookupsContext) need a READER — a deactivated job board
 * must drop off the publish panel, and a brand-new vacancy's panel must pre-check the
 * tenant's default_enabled channels. §13: assert the actual toggle state that reaches
 * the DOM, not just that the tab renders.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import PublishingTab from './PublishingTab'
import type { VacancyDetail } from '@/types/vacancy'

// Resolve the active locale's own copy so assertions never hardcode a language.
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'vacancies', ...opts })

// Three channels: one active+pre-checked, one active+not-pre-checked, one
// deactivated (must never reach the panel at all).
const CHANNELS = [
  { value: 'career', label: 'Career page', active: true, default_enabled: true },
  { value: 'indeed', label: 'Indeed', active: true, default_enabled: false },
  { value: 'old', label: 'Retired board', active: false, default_enabled: true },
]
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ channels: CHANNELS }),
}))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getJsonSetting: (_s: unknown, _key: string, fallback: unknown) => fallback,
}))

afterEach(() => vi.clearAllMocks())

const vacancy = (channels: VacancyDetail['channels'] = []) =>
  ({ id: 'v1', title: 'Verpleegkundige', channels, applicationSettings: {} } as VacancyDetail)

// The channel toggles live on the "Vacaturesites" sub-tab, not the default one.
const openSitesTab = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('tab', { name: t('publishing.tabs.sites') }))
}

describe('PublishingTab · channel flags', () => {
  it('drops a deactivated channel from the publish panel entirely', async () => {
    render(<PublishingTab vacancy={vacancy()} />)
    await openSitesTab()

    expect(screen.getByText('Career page')).toBeInTheDocument()
    expect(screen.getByText('Indeed')).toBeInTheDocument()
    expect(screen.queryByText('Retired board')).not.toBeInTheDocument()
  })

  it('pre-checks the tenant default_enabled channels on a brand-new vacancy (no saved channel state)', async () => {
    render(<PublishingTab vacancy={vacancy([])} />)
    await openSitesTab()

    const switches = screen.getAllByRole('switch')
    // career (default_enabled: true) pre-checked; indeed (default_enabled: false) is not.
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it("honours the vacancy's own saved channel state over the tenant default once any exists", async () => {
    render(<PublishingTab vacancy={vacancy([{ value: 'career', label: 'Career page', published: false }])} />)
    await openSitesTab()

    // career is default_enabled:true, but the vacancy explicitly saved it OFF —
    // the saved record wins, so it must never come back on just because a
    // sibling channel (indeed) never saved anything for it.
    const switches = screen.getAllByRole('switch')
    expect(switches[0]).toHaveAttribute('aria-checked', 'false')
  })
})
