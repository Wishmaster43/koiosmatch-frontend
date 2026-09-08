/**
 * CatalogSection — the four states against the catalogue fixture: the generic rows of
 * a section render as SchemaSection rows under their contract label keys, a dedicated
 * row stays out, an unknown section shows the empty notice, a failed GET the banner.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import api from '@/lib/api'
import i18n from '@/i18n'
import CatalogSection from './CatalogSection'
import { catalogFixture } from '../catalog/catalogFixture'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

const st = (key: string) => i18n.t(key, { ns: 'settings' })

// Route the two GETs the screen makes: the catalogue and the flat settings bag.
function armApi(catalog: unknown = catalogFixture, bag: Record<string, string> = {}) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/settings/catalog') return catalog instanceof Error ? Promise.reject(catalog) : Promise.resolve({ data: catalog })
    if (url === '/settings') return Promise.resolve({ data: bag })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

function renderSection(section: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><CatalogSection section={section} /></QueryClientProvider>)
}

describe('CatalogSection', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the generic rows of the section under their contract label keys with the stored values', async () => {
    armApi(catalogFixture, { no_contact_days: '45' })
    renderSection('windows')
    await waitFor(() => expect(screen.getByText('settings.windows.no_contact_days.label')).toBeTruthy())
    expect(screen.getByText('settings.windows.stale_candidate_days.label')).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/settings/catalog')
    await waitFor(() => expect((screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value).toBe('45'))
  })

  it('keeps a dedicated row off the generic screen', async () => {
    const withDedicated = JSON.parse(JSON.stringify(catalogFixture))
    withDedicated.data.sections[0].keys[1].ui = 'dedicated'
    armApi(withDedicated)
    renderSection('windows')
    await waitFor(() => expect(screen.getByText('settings.windows.no_contact_days.label')).toBeTruthy())
    expect(screen.queryByText('settings.windows.stale_candidate_days.label')).toBeNull()
  })

  it('shows the empty notice for a section the catalogue does not carry', async () => {
    armApi()
    renderSection('vacancies')
    await waitFor(() => expect(screen.getByText(st('catalog.empty'))).toBeTruthy())
  })

  it('shows the error banner with a retry when the catalogue fails to load', async () => {
    armApi(new Error('boom'))
    renderSection('windows')
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('button')).toBeTruthy()
  })
})
