/**
 * PublicUrlsCard — covers the four states this card can be in: no tenant known
 * yet (honest empty state, no "undefined" URL), the ungated site-info URL always
 * shown active, and the gated feed/vacancy/sitemap URLs carrying the inactive
 * notice + non-navigating placeholder while `career_site_active` is off.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import PublicUrlsCard from './PublicUrlsCard'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
// Same VITE_API_URL-derived base the component itself resolves (.env sets it to
// the relative dev-proxy path '/api', not the absolute prod fallback) — computed
// here instead of hardcoded so the assertion holds under either configuration.
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://koiosmatch-api.test/api'

const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

afterEach(() => vi.clearAllMocks())

describe('PublicUrlsCard — no tenant resolved yet', () => {
  it('shows an honest empty state instead of an URL built on an unknown tenant', () => {
    mockUseAuth.mockReturnValue({ activeTenant: null })
    render(<PublicUrlsCard active={false} />)

    expect(screen.getByText(t('careerSite.urls.noTenant'))).toBeInTheDocument()
    expect(screen.queryByText(/\/public\//)).not.toBeInTheDocument()
  })
})

describe('PublicUrlsCard — career site OFF', () => {
  it('keeps the site-info URL live but marks every gated route with the inactive notice', () => {
    mockUseAuth.mockReturnValue({ activeTenant: { id: 'yesway' } })
    render(<PublicUrlsCard active={false} />)

    // The always-reachable site-info URL carries no notice and stays a real link.
    const siteRow = screen.getByText(/\/public\/yesway\/site$/).closest('div')
    expect(siteRow).not.toBeNull()

    // Every gated route shows the inactive notice (5 URLs total, 4 gated).
    expect(screen.getAllByText(t('careerSite.urls.inactiveNotice'))).toHaveLength(4)
  })
})

describe('PublicUrlsCard — career site ON', () => {
  it('renders every URL from the contract with no inactive notice', () => {
    mockUseAuth.mockReturnValue({ activeTenant: { id: 'yesway' } })
    render(<PublicUrlsCard active />)

    expect(screen.getByText(`${API_BASE}/public/yesway/site`)).toBeInTheDocument()
    expect(screen.getByText(`${API_BASE}/public/yesway/vacancies`)).toBeInTheDocument()
    expect(screen.getByText(`${API_BASE}/public/yesway/sitemap.xml`)).toBeInTheDocument()
    expect(screen.getByText(`${API_BASE}/public/yesway/feeds/indeed.xml`)).toBeInTheDocument()
    expect(screen.getByText(`${API_BASE}/public/yesway/feeds/werkzoeken.xml`)).toBeInTheDocument()
    expect(screen.queryByText(t('careerSite.urls.inactiveNotice'))).not.toBeInTheDocument()
  })
})
