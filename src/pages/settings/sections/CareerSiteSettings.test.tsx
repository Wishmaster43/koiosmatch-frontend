/**
 * CareerSiteSettings — the toggle uses the shared house Toggle (role="switch"),
 * not a raw checkbox (Danny 28-07: "MOET OOK EEN TOGGLE WORDEN!!"). §13: the save
 * assertion checks the REQUEST (settings POST body), not a callback. Also covers
 * the PublicUrlsCard wiring: the `active` flag it derives from the coerced setting
 * value reaches the card (own dedicated tests in careerSite/PublicUrlsCard.test.tsx
 * cover the card's own four states in depth).
 *
 * SUB-TABS (13-09): the screen now splits into "Settings" (default tab) and
 * "Public URLs" — the public-URLs assertions below click into that second tab first.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CareerSiteSettings from './CareerSiteSettings'
import { publicApiBase } from '@/lib/publicApiUrl'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// Same VITE_API_URL-derived base PublicUrlsCard resolves (.env sets the relative
// dev-proxy path '/api', not the absolute prod fallback) — computed, not hardcoded.
// The card composes ABSOLUTE URLs via publicApiBase (regression 31-08: the
// cookie setup's relative /api base leaked into copy targets) — pin the same.
const API_BASE = publicApiBase()

// Route the shared settings loader: the blob is controlled per test; saves go
// through the REAL saveSettingsKeys so the api.post seam is asserted.
const blobRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
// getActiveTenantId is the real (unmocked) useAllSettings module's tenant-scope key.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: postMock },
  getActiveTenantId: vi.fn(() => null),
}))
// PublicUrlsCard reads useAuth().activeTenant.id — a real tenant here so the card
// renders real rows (never "undefined") without pulling every URL-row assertion
// into this file (that's PublicUrlsCard.test.tsx's job).
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeTenant: { id: 'yesway' } }) }))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

describe('CareerSiteSettings — the toggle', () => {
  it('renders unchecked when the setting is absent', () => {
    render(<CareerSiteSettings />)
    expect(screen.getByRole('switch')).not.toBeChecked()
  })

  it.each([[true], [1], ['1'], ['true']])('coerces stored truthy form %p to checked', (v) => {
    blobRef.current = { career_site_active: v }
    render(<CareerSiteSettings />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('toggling POSTs the settings key immediately (stringified boolean)', async () => {
    const user = userEvent.setup()
    render(<CareerSiteSettings />)
    await user.click(screen.getByRole('switch'))
    expect(postMock).toHaveBeenCalledWith('/settings', { career_site_active: 'true' })
  })
})

describe('CareerSiteSettings — the career_site_url field', () => {
  it('renders the stored URL value', () => {
    blobRef.current = { career_site_url: 'https://werkenbij.voorbeeld.nl/vacature/{ref}' }
    render(<CareerSiteSettings />)
    expect(screen.getByDisplayValue('https://werkenbij.voorbeeld.nl/vacature/{ref}')).toBeInTheDocument()
  })

  it('updates the input value as the user types', async () => {
    blobRef.current = { career_site_url: '' }
    render(<CareerSiteSettings />)
    const input = screen.getByPlaceholderText('https://werkenbij.voorbeeld.nl/vacature/{ref}') as HTMLInputElement
    // fireEvent.change directly sets the value (avoids userEvent special char escaping issues)
    fireEvent.change(input, { target: { value: 'https://jobs.example.com/roles/{ref}' } })
    expect(input.value).toBe('https://jobs.example.com/roles/{ref}')
  })

  it('POSTs career_site_url on blur with a valid URL containing {ref}', async () => {
    blobRef.current = { career_site_url: '' }
    render(<CareerSiteSettings />)
    const input = screen.getByPlaceholderText('https://werkenbij.voorbeeld.nl/vacature/{ref}') as HTMLInputElement
    // fireEvent.change directly sets the value (avoids userEvent special char escaping issues)
    fireEvent.change(input, { target: { value: 'https://jobs.example.com/roles/{ref}' } })
    fireEvent.blur(input)
    expect(postMock).toHaveBeenCalledWith('/settings', { career_site_url: 'https://jobs.example.com/roles/{ref}' })
  })

  it('shows the invalid hint and does not save when URL lacks {ref}', async () => {
    const user = userEvent.setup()
    blobRef.current = { career_site_url: '' }
    render(<CareerSiteSettings />)
    const input = screen.getByPlaceholderText('https://werkenbij.voorbeeld.nl/vacature/{ref}') as HTMLInputElement
    await user.type(input, 'https://example.com/vacancies/123')
    fireEvent.blur(input)
    expect(screen.getByText(t('careerSite.urlInvalid'))).toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
  })
})

describe('CareerSiteSettings — the public URLs card', () => {
  it('renders the site-info URL live regardless of the toggle state', async () => {
    const user = userEvent.setup()
    render(<CareerSiteSettings />)
    // SUB-TABS: the public-URLs card lives under its own tab now.
    await user.click(screen.getByRole('tab', { name: t('careerSite.urls.title') }))
    expect(screen.getByText(`${API_BASE}/public/yesway/site`)).toBeInTheDocument()
  })

  it('marks the gated routes with the inactive notice while the toggle is off', async () => {
    const user = userEvent.setup()
    render(<CareerSiteSettings />)
    await user.click(screen.getByRole('tab', { name: t('careerSite.urls.title') }))
    expect(screen.getAllByText(t('careerSite.urls.inactiveNotice')).length).toBeGreaterThan(0)
  })

  it('drops the inactive notice once the toggle is on', async () => {
    const user = userEvent.setup()
    blobRef.current = { career_site_active: true }
    render(<CareerSiteSettings />)
    await user.click(screen.getByRole('tab', { name: t('careerSite.urls.title') }))
    expect(screen.queryByText(t('careerSite.urls.inactiveNotice'))).not.toBeInTheDocument()
  })
})

describe('CareerSiteSettings — sub-tabs (13-09)', () => {
  it('defaults to the settings tab, with the toggle and URL field visible', () => {
    render(<CareerSiteSettings />)
    expect(screen.getByRole('tab', { name: t('careerSite.tabs.settings') })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('switches to the public-URLs tab on click, hiding the settings fields', async () => {
    const user = userEvent.setup()
    render(<CareerSiteSettings />)
    await user.click(screen.getByRole('tab', { name: t('careerSite.urls.title') }))
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByText(t('careerSite.urls.subtitle'))).toBeInTheDocument()
  })
})
