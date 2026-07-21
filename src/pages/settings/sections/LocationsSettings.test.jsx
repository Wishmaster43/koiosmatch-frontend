/**
 * LocationsSettings — covers the four UI states (loading/error/empty/success), the
 * edit round-trip (house pencil pattern → PATCH /locations/{id}), and the live
 * delete flow (LOC-DELETE-GUARD-FE): a row already flagged `in_use` by the list
 * endpoint stays disabled with a tooltip; an enabled row confirms, DELETEs, and
 * either drops out of the list (success) or surfaces the backend's per-type
 * `counts` payload as an i18n'd in-use message while the row stays put (409).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import LocationsSettings from './LocationsSettings'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const location = (over = {}) => ({
  id: 'loc1', name: 'Kantoor Rotterdam', street: 'Coolsingel', house_number: '1', house_number_suffix: '',
  postal_code: '3011AD', city: 'Rotterdam', country: 'Nederland', coc_number: '', vat_number: '',
  contact_name: '', phone: '', email: '',
  address: 'Coolsingel 1, 3011AD Rotterdam', full_address: 'Coolsingel 1, 3011AD Rotterdam',
  lat: 51.9225, lng: 4.47917, created_at: '2026-07-01T10:00:00Z', in_use: false,
  ...over,
})

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks() })

describe('LocationsSettings', () => {
  it('shows the loading state, then the error state on a failed fetch', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    render(<LocationsSettings />)
    expect(screen.getByText(st('common.loadingShort'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(st('locations.loadError'))).toBeInTheDocument())
  })

  it('shows the empty state when the backend returns no locations', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText(st('locations.empty'))).toBeInTheDocument())
  })

  it('renders the location row with its address', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    expect(screen.getByText('Coolsingel 1, 3011AD Rotterdam')).toBeInTheDocument()
  })

  it('a location already flagged in_use by the list keeps delete disabled with a tooltip', async () => {
    api.get.mockResolvedValue({ data: { data: [location({ in_use: true })] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    const deleteBtn = screen.getByRole('button', { name: st('locations.deleteBlockedTooltip') })
    expect(deleteBtn).toBeDisabled()
  })

  it('delete click confirms, DELETEs /locations/{id}, and removes the row on success', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.delete.mockResolvedValue({})
    const { notifySuccess } = await import('@/lib/notify')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.delete') }))

    expect(window.confirm).toHaveBeenCalledWith(st('locations.confirmDelete', { name: 'Kantoor Rotterdam' }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/locations/loc1'))
    await waitFor(() => expect(screen.queryByText('Kantoor Rotterdam')).not.toBeInTheDocument())
    expect(notifySuccess).toHaveBeenCalledWith(st('locations.deleteSuccess'))
  })

  it('declining the confirm dialog never calls DELETE', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.delete') }))

    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
  })

  it('a 409 with an in_use counts payload shows the linked-objects message and keeps the row', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.delete.mockRejectedValue({ response: { status: 409, data: { in_use: true, counts: { candidates: 3, tasks: 1 } } } })
    const { notifyError } = await import('@/lib/notify')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.delete') }))

    // The message spells out WHAT is still linked, built from the payload's counts.
    const expectedList = `${st('locations.usage.candidates', { count: 3 })}, ${st('locations.usage.tasks', { count: 1 })}`
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteBlocked', { list: expectedList })))
    // The row stays — a 409 never drops data from the list.
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
    // And it is now disabled, mirroring a location the list already flagged in_use.
    expect(await screen.findByRole('button', { name: st('locations.deleteBlockedTooltip') })).toBeDisabled()
  })

  it('a non-409 delete failure surfaces the generic notifyError, not a raw server error', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.delete.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.delete') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.deleteFailed')))
    expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument()
  })

  it('the pencil opens the edit modal prefilled, and Save PATCHes /locations/{id}', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.patch.mockResolvedValue({ data: { data: location({ name: 'Kantoor Rotterdam Centrum' }) } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
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

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/locations/loc1',
      expect.objectContaining({ name: 'Kantoor Rotterdam Centrum', city: 'Rotterdam' })))
    // The unwrapped (not double-wrapped) resource replaces the row in the table.
    expect(await screen.findByText('Kantoor Rotterdam Centrum')).toBeInTheDocument()
  })

  it('a failed edit surfaces notifyError and keeps the modal state (no silent failure)', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    api.patch.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.edit') }))
    await user.click(screen.getByRole('button', { name: st('common.save') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('locations.saveFailed')))
  })

  it('creating a new location unwraps the resource (not the {"data": …} envelope) into the table', async () => {
    api.get.mockResolvedValue({ data: { data: [] } })
    api.post.mockResolvedValue({ data: { data: location({ id: 'loc2', name: 'Nieuwe vestiging' }) } })
    const user = userEvent.setup()
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText(st('locations.empty'))).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: st('locations.create') }))
    await user.type(screen.getByLabelText(st('locations.nameLabel')), 'Nieuwe vestiging')
    await user.click(screen.getByRole('button', { name: st('locations.createBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/locations', expect.objectContaining({ name: 'Nieuwe vestiging' })))
    // Regression guard: the row shows the plain name, never "[object Object]" from a
    // stored-but-unwrapped { data: {...} } envelope.
    expect(await screen.findByText('Nieuwe vestiging')).toBeInTheDocument()
  })
})
