import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TenantLayout } from './theme'
import { strings } from './strings'
import * as api from './api'
import type { SiteInfo } from './types'

// Only the network call is mocked — the status branching (loading/error/inactive/
// success) in useSiteTheme/TenantLayout runs for real.
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, fetchSite: vi.fn() }
})

const mockedFetchSite = vi.mocked(api.fetchSite)
const CHILD_CONTENT = 'child route content'

// Builds a full SiteInfo response — tests override only the field they care about.
function makeSite(overrides: Partial<SiteInfo> = {}): SiteInfo {
  return {
    tenant: 'acme',
    name: 'Acme Zorg',
    brand_color: '#123456',
    logo_url: null,
    address: null,
    active: true,
    ...overrides,
  }
}

// Renders TenantLayout under a real /:tenant route with one dummy child route,
// mirroring App.tsx's own route nesting.
function renderTenantLayout(tenant = 'acme') {
  return render(
    <MemoryRouter initialEntries={[`/${tenant}`]}>
      <Routes>
        <Route path="/:tenant" element={<TenantLayout />}>
          <Route index element={<p>{CHILD_CONTENT}</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedFetchSite.mockReset()
  document.documentElement.style.removeProperty('--brand')
})

describe('TenantLayout / useSiteTheme', () => {
  it('applies the tenant brand color and renders the child route on an active site', async () => {
    mockedFetchSite.mockResolvedValue(makeSite({ brand_color: '#ff00aa', active: true }))
    renderTenantLayout()

    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--brand')).toBe('#ff00aa'))
    expect(await screen.findByText(CHILD_CONTENT)).toBeTruthy()
  })

  it('falls back to the neutral brand color and shows a calm notice when the site fetch fails', async () => {
    mockedFetchSite.mockRejectedValue(new Error('network down'))
    renderTenantLayout()

    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--brand')).not.toBe(''))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(strings.home.title)).toBeTruthy()
    expect(screen.queryByText(CHILD_CONTENT)).toBeNull()
  })

  it('shows the "site not active" notice — never the child route — when the API reports active:false', async () => {
    mockedFetchSite.mockResolvedValue(makeSite({ active: false }))
    renderTenantLayout()

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(strings.inactive.title)).toBeTruthy()
    expect(screen.getByText(strings.inactive.body)).toBeTruthy()
    expect(screen.queryByText(CHILD_CONTENT)).toBeNull()
  })
})
