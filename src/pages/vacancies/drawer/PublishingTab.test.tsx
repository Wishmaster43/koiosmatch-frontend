/**
 * PublishingTab — round-4 audit finding #3: the channel flags (active/default_enabled,
 * carried through by VacancyLookupsContext) need a READER — a deactivated job board
 * must drop off the publish panel, and a brand-new vacancy's panel must pre-check the
 * tenant's default_enabled channels. §13: assert the actual toggle state that reaches
 * the DOM, not just that the tab renders.
 *
 * CAREER-SITE-ACTIVE (career-vacancy-koppeling): the 'career' channel toggle is a REAL
 * control — clicking it calls onUpdate with the exact `channels` shape that becomes the
 * PATCH `published_channels` body the backend's VacancyWriter::syncChannels upserts into
 * vacancy_channel_publications (§13: assert the REQUEST, not just that a callback fired).
 * The panel's banner + per-row status label must also honestly reflect the tenant's own
 * `career_site_active` setting (EnsureCareerSiteActive) rather than a static claim —
 * `@/lib/settings/useAllSettings` is mocked with a mutable blob (real `getBoolSetting`/
 * `getJsonSetting` kept via importActual, mirrors OverviewTab.test.tsx's VESTIGING-2
 * pattern) so that coercion is exercised for real, not stubbed away.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'
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

// Mutable per-test settings blob — default {} so career_site_active falls back to
// false (matches the real tenant default: opt-in) unless a test opts in.
let mockSettings: Record<string, unknown> = {}
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings }
})

afterEach(() => {
  vi.clearAllMocks()
  mockSettings = {}
})

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

describe('PublishingTab · toggling a channel persists the real request shape', () => {
  it('calls onUpdate with the full channels set, the clicked channel flipped, on the career toggle', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<PublishingTab vacancy={vacancy([
      { value: 'career', label: 'Career page', published: false },
      { value: 'indeed', label: 'Indeed', published: false },
    ])} onUpdate={onUpdate} />)
    await openSitesTab()

    // Click the career row's toggle (first switch) — this is the exact interaction
    // that has to become PATCH { published_channels: [{ value: <channel_id>, ... }] }
    // server-side (VacancyWriter::syncChannels resolves `value` against VacancyChannel ids).
    await user.click(screen.getAllByRole('switch')[0])

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('v1', {
      channels: [
        { value: 'career', label: 'Career page', published: true },
        { value: 'indeed', label: 'Indeed', published: false },
      ],
    })
  })
})

describe('PublishingTab · honest career-site-active state', () => {
  it('shows the site-offline banner and a QUEUED row when career_site_active is off (default)', async () => {
    render(<PublishingTab vacancy={vacancy([{ value: 'career', label: 'Career page', published: true }])} />)
    await openSitesTab()

    expect(screen.getByText(t('publishing.siteOffline'))).toBeInTheDocument()
    expect(screen.queryByText(t('publishing.siteLive'))).not.toBeInTheDocument()
    // The 'career' channel is toggled on but the tenant hasn't switched the site on
    // yet, so it must read as queued, never as already published.
    expect(screen.getByText(t('publishing.queuedOn'))).toBeInTheDocument()
    expect(screen.queryByText(t('publishing.publishedOn'))).not.toBeInTheDocument()
  })

  it('shows the site-live banner and a PUBLISHED row once career_site_active is on', async () => {
    mockSettings = { career_site_active: 'true' }
    render(<PublishingTab vacancy={vacancy([{ value: 'career', label: 'Career page', published: true }])} />)
    await openSitesTab()

    expect(screen.getByText(t('publishing.siteLive'))).toBeInTheDocument()
    expect(screen.queryByText(t('publishing.siteOffline'))).not.toBeInTheDocument()
    expect(screen.getByText(t('publishing.publishedOn'))).toBeInTheDocument()
  })

  it('a channel that is simply off always reads Not published, regardless of site state', async () => {
    mockSettings = { career_site_active: 'true' }
    // indeed stays ON here so only the career row can match "Not published" —
    // an unambiguous single-element assertion instead of counting duplicates.
    render(<PublishingTab vacancy={vacancy([
      { value: 'career', label: 'Career page', published: false },
      { value: 'indeed', label: 'Indeed', published: true },
    ])} />)
    await openSitesTab()

    expect(screen.getByText(t('publishing.notPublished'))).toBeInTheDocument()
    expect(screen.getByText(t('publishing.publishedOn'))).toBeInTheDocument()
  })
})

// V-pub-1: switching the drawer target vacancy must resync the local channel/
// settings/subTab state — previously the useState only seeded once, so vacancy
// B kept rendering vacancy A's channels and application-field settings.
describe('PublishingTab · V-pub-1 resyncs on vacancy switch', () => {
  const vacancyA = { id: 'a', title: 'A', channels: [{ value: 'career', label: 'Career page', published: true }], applicationSettings: { cv: 'required' } } as unknown as VacancyDetail
  const vacancyB = { id: 'b', title: 'B', channels: [{ value: 'career', label: 'Career page', published: false }], applicationSettings: { cv: 'hidden' } } as unknown as VacancyDetail

  function Switcher() {
    const [v, setV] = useState<VacancyDetail>(vacancyA)
    return (
      <div>
        <button onClick={() => setV(vacancyB)}>switch</button>
        <PublishingTab vacancy={v} />
      </div>
    )
  }

  it("renders vacancy B's channel state, not A's, after switching", async () => {
    const user = userEvent.setup()
    render(<Switcher />)
    await user.click(screen.getByText('switch'))
    await openSitesTab()

    // Vacancy B's own saved 'career' state (published: false) must win — a stale
    // A-seeded state would have left the switch checked.
    expect(screen.getAllByRole('switch')[0]).toHaveAttribute('aria-checked', 'false')
  })
})
