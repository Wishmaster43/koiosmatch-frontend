/**
 * LocationsSettings — covers the four UI states (loading/error/empty/success), the
 * edit round-trip (house pencil pattern → PATCH /locations/{id}), and the live
 * delete flow (LOC-DELETE-GUARD-FE): a row already flagged `in_use` by the list
 * endpoint stays disabled with a tooltip; an enabled row confirms via the shared
 * house ConfirmDialog (useConfirm — never native window.confirm), DELETEs, and
 * either drops out of the list (success) or surfaces the backend's per-type
 * `counts` payload as an i18n'd in-use message while the row stays put (409).
 * VESTIGING-ICOON-1 (the badge colour/icon fallback and the create/update payload)
 * lives in LocationsSettings.crud.test.tsx since the 13-11 split; shared fixtures
 * and helpers in LocationsSettings.testKit.tsx.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import api from '@/lib/api'
// vi.mocked() gives the mocked-module factory's plain vi.fn()s their real Mock typing at every call site.
const mockedApi = vi.mocked(api, true)
import { renderPage, st, confirmDelete, location } from './LocationsSettings.testKit'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
// Connector modules switchable per test; permissions all granted.
const mockModules = vi.hoisted(() => ({ on: new Set<string>() }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasModule: (k: string) => mockModules.on.has(k), hasPermission: () => true }),
}))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); mockModules.on.clear() })

describe('LocationsSettings', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    mockedApi.get.mockRejectedValue(new Error('network down'))
    renderPage()
    expect(screen.getByText(st('common.loadingShort'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(st('locations.loadError'))).toBeInTheDocument())
  })

  it('fetches locations across all pages when lastPage > 1', async () => {
    // First page response: 2 locations, lastPage = 2
    const page1Rows = [location({ id: 'loc1', name: 'Vestiging 1' }), location({ id: 'loc2', name: 'Vestiging 2' })]
    // Second page response: 1 location
    const page2Rows = [location({ id: 'loc3', name: 'Vestiging 3' })]

    mockedApi.get.mockImplementation((_path, config) => {
      const currentPage = (config?.params as { page?: number } | undefined)?.page ?? 1
      if (currentPage === 1) {
        return Promise.resolve({
          data: {
            data: page1Rows,
            meta: { total: 3, current_page: 1, per_page: 100, last_page: 2 },
          },
        })
      }
      return Promise.resolve({
        data: {
          data: page2Rows,
          meta: { total: 3, current_page: 2, per_page: 100, last_page: 2 },
        },
      })
    })

    renderPage()

    // Verify both pages were fetched.
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/locations', { params: { per_page: 100 }, signal: expect.any(AbortSignal) })
      expect(mockedApi.get).toHaveBeenCalledWith('/locations', { params: { per_page: 100, page: 2 }, signal: expect.any(AbortSignal) })
    })

    // All rows from both pages are rendered.
    expect(await screen.findByText('Vestiging 1')).toBeInTheDocument()
    expect(screen.getByText('Vestiging 2')).toBeInTheDocument()
    expect(screen.getByText('Vestiging 3')).toBeInTheDocument()
  })

  it('fetches locations with per_page=100 and handles single-page results', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [location()],
        meta: { total: 1, current_page: 1, per_page: 100, last_page: 1 },
      },
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    // Only page 1 is fetched when lastPage is 1.
    expect(mockedApi.get).toHaveBeenCalledTimes(1)
    expect(mockedApi.get).toHaveBeenCalledWith('/locations', { params: { per_page: 100 }, signal: expect.any(AbortSignal) })
  })

  it('shows the empty state when the backend returns no locations', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [] } })
    renderPage()
    await waitFor(() => expect(screen.getByText(st('locations.empty'))).toBeInTheDocument())
  })

  it('renders the location row with its address', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    expect(screen.getByText('Coolsingel 1, 3011AD Rotterdam')).toBeInTheDocument()
  })

  it('a location already flagged in_use by the list keeps delete disabled with a tooltip', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location({ in_use: true })] } })
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    const deleteBtn = screen.getByRole('button', { name: st('locations.deleteBlockedTooltip') })
    expect(deleteBtn).toBeDisabled()
  })

  it('delete click confirms via the house dialog, DELETEs /locations/{id}, and removes the row on success', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    mockedApi.delete.mockResolvedValue({})
    const { notifySuccess } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    await waitFor(() => expect(mockedApi.delete).toHaveBeenCalledWith('/locations/loc1'))
    await waitFor(() => expect(screen.queryByText('Kantoor Rotterdam')).not.toBeInTheDocument())
    expect(notifySuccess).toHaveBeenCalledWith(st('locations.deleteSuccess'))
  })

  it('declining the house confirm dialog never calls DELETE', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam', { accept: false })

    expect(mockedApi.delete).not.toHaveBeenCalled()
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
  })

  it('a 409 with an in_use counts payload shows the linked-objects message and keeps the row', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    mockedApi.delete.mockRejectedValue({ response: { status: 409, data: { in_use: true, counts: { candidates: 3, tasks: 1 } } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    // The message spells out WHAT is still linked, built from the payload's counts.
    const expectedList = `${st('locations.usage.candidates', { count: 3 })}, ${st('locations.usage.tasks', { count: 1 })}`
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteBlocked', { list: expectedList })))
    // The row stays — a 409 never drops data from the list.
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
    // And it is now disabled, mirroring a location the list already flagged in_use.
    expect(await screen.findByRole('button', { name: st('locations.deleteBlockedTooltip') })).toBeDisabled()
  })

  // ONIX C-003 census: the staff/role pivots (and webhooks, WhatsApp-Web devices, API keys)
  // now block a branch delete too — every key the server sends renders as a label, never raw.
  it('a 409 with the C-003 census keys lists them translated (never a raw staff_couplings key)', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    mockedApi.delete.mockRejectedValue({ response: { status: 409, data: { in_use: true, counts: { staff_couplings: 2, role_couplings: 1, api_keys: 1 } } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    const expectedList = [
      st('locations.usage.staffCouplings', { count: 2 }),
      st('locations.usage.roleCouplings', { count: 1 }),
      st('locations.usage.apiKeys', { count: 1 }),
    ].join(', ')
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteBlocked', { list: expectedList })))
    expect(String(vi.mocked(notifyError).mock.calls.at(-1)?.[0])).not.toMatch(/staff_couplings|role_couplings|api_keys/)
  })

  // BE E1 (WAVE2-HIGH-PRIVACY-SCOPE-1): call lists, customer-branch links and customer locations on the branch block the delete too.
  it('a 409 with the E1 counts lists call lists, customer links and customer locations translated (never a raw outreach_campaigns key)', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    mockedApi.delete.mockRejectedValue({ response: { status: 409, data: { in_use: true, counts: { outreach_campaigns: 1, branch_links: 2, customer_locations: 3 } } } })
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    const expectedList = [
      st('locations.usage.outreachCampaigns', { count: 1 }),
      st('locations.usage.branchLinks', { count: 2 }),
      st('locations.usage.customerLocations', { count: 3 }),
    ].join(', ')
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteBlocked', { list: expectedList })))
    expect(String(vi.mocked(notifyError).mock.calls.at(-1)?.[0])).not.toMatch(/outreach_campaigns|branch_links|customer_locations/)
  })

  it('a non-409 delete failure surfaces the generic notifyError, not a raw server error', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    mockedApi.delete.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await confirmDelete(user, 'Kantoor Rotterdam')

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteFailed')))
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
  })

  it('the pencil opens the edit modal prefilled, and Save PATCHes /locations/{id}', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    mockedApi.patch.mockResolvedValue({ data: { data: location({ name: 'Kantoor Rotterdam Centrum' }) } })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.edit') }))
    expect(screen.getByText(st('locations.editTitle'))).toBeInTheDocument()

    // Prefilled from the row — not a blank create form.
    const nameInput = screen.getByLabelText(st('locations.nameLabel'))
    expect(nameInput).toHaveValue('Kantoor Rotterdam')
    const cityInput = screen.getByLabelText(st('locations.city'))
    expect(cityInput).toHaveValue('Rotterdam')

    await user.clear(nameInput)
    await user.type(nameInput, 'Kantoor Rotterdam Centrum')
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/locations/loc1',
      expect.objectContaining({ name: 'Kantoor Rotterdam Centrum', city: 'Rotterdam' })))
    // The unwrapped (not double-wrapped) resource replaces the row in the table.
    expect(await screen.findByText('Kantoor Rotterdam Centrum')).toBeInTheDocument()
  })

  it('a failed edit surfaces notifyError and keeps the modal state (no silent failure)', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [location()] } })
    mockedApi.patch.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.edit') }))
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.saveFailed')))
  })
})
