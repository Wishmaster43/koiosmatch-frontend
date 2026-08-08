/**
 * CareerSiteSettings — the toggle uses the shared house Toggle (role="switch"),
 * not a raw checkbox (Danny 28-07: "MOET OOK EEN TOGGLE WORDEN!!"). §13: the save
 * assertion checks the REQUEST (settings POST body), not a callback. Also covers
 * the PublicUrlsCard wiring: the `active` flag it derives from the coerced setting
 * value reaches the card (own dedicated tests in careerSite/PublicUrlsCard.test.tsx
 * cover the card's own four states in depth).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CareerSiteSettings from './CareerSiteSettings'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// Same VITE_API_URL-derived base PublicUrlsCard resolves (.env sets the relative
// dev-proxy path '/api', not the absolute prod fallback) — computed, not hardcoded.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'

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

describe('CareerSiteSettings — the public URLs card', () => {
  it('renders the site-info URL live regardless of the toggle state', () => {
    render(<CareerSiteSettings />)
    expect(screen.getByText(`${API_BASE}/public/yesway/site`)).toBeInTheDocument()
  })

  it('marks the gated routes with the inactive notice while the toggle is off', () => {
    render(<CareerSiteSettings />)
    expect(screen.getAllByText(t('careerSite.urls.inactiveNotice')).length).toBeGreaterThan(0)
  })

  it('drops the inactive notice once the toggle is on', () => {
    blobRef.current = { career_site_active: true }
    render(<CareerSiteSettings />)
    expect(screen.queryByText(t('careerSite.urls.inactiveNotice'))).not.toBeInTheDocument()
  })
})
