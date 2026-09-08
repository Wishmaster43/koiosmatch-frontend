/**
 * CustomerSourcesSettings — CUST-SOURCE-FE-1. Mirrors
 * ApplicationSourcesSettings.test.jsx (thin config, same shared component): the
 * free-entry toggle reflects and persists through the REAL dedicated
 * `PUT /customer-sources/free-entry` route, and a create/GET round-trip hits
 * the real `/customer-sources` lookup.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

afterEach(() => vi.clearAllMocks())

// useCachedLookup caches /customer-sources at module scope, so each case needs
// a fresh module graph (mirrors ApplicationSourcesSettings.test.jsx).
async function renderWithSources(sourceRows = [], allowFreeEntry = false) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  apiModule.default.get.mockImplementation(url => {
    if (url === '/customer-sources' || url === '/customer-sources?active=1') return Promise.resolve({ data: { data: sourceRows, allow_free_entry: allowFreeEntry } })
    return Promise.resolve({ data: {} })
  })
  const { default: CustomerSourcesSettings } = await import('./CustomerSourcesSettings')
  render(<CustomerSourcesSettings />)
  return apiModule.default
}

describe('CustomerSourcesSettings — wired to the REAL /customer-sources lookup', () => {
  it('GETs /customer-sources on mount with no params', async () => {
    const api = await renderWithSources()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customer-sources?active=1', undefined))
  })

  it('reflects the API allow_free_entry:true as checked', async () => {
    await renderWithSources([], true)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('turning it OFF PUTs the REAL dedicated route (never the generic /settings blob)', async () => {
    const api = await renderWithSources([], true)
    api.put.mockResolvedValue({ data: { allow_free_entry: false } })
    const user = userEvent.setup()
    const toggle = await screen.findByRole('switch')
    await user.click(toggle)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/customer-sources/free-entry', { allow_free_entry: false }))
    expect(api.post).not.toHaveBeenCalledWith('/settings', expect.anything())
  })

  it('creating a new source POSTs it to /customer-sources', async () => {
    const api = await renderWithSources()
    api.post.mockResolvedValue({ data: { id: 's1', name: 'LinkedIn' } })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: st('customerSourcesSettings.add') }))
    await user.type(screen.getByPlaceholderText(st('statusList.namePlaceholder')), 'LinkedIn')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customer-sources', expect.objectContaining({ name: 'LinkedIn' })))
  })

  it('renders the seeded rows from the real lookup response', async () => {
    await renderWithSources([{ id: 's1', name: 'Google' }])
    expect(await screen.findByText('Google')).toBeInTheDocument()
  })
})
