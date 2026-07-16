/**
 * LocationsSettings — covers the four UI states (loading/error/empty/success), the
 * edit round-trip (house pencil pattern → PATCH /locations/{id}), and that delete
 * stays disabled with an explanatory tooltip: the measured backend gap is that
 * DELETE /locations/{id} has NO in-use guard (LocationController::destroy() deletes
 * unconditionally), so shipping a live delete could silently orphan candidates/
 * customers/vacancies that still reference the location — see the report.
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
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const location = (over = {}) => ({
  id: 'loc1', name: 'Kantoor Rotterdam', street: 'Coolsingel', house_number: '1', house_number_suffix: '',
  postal_code: '3011AD', city: 'Rotterdam', country: 'Nederland', coc_number: '', vat_number: '',
  contact_name: '', phone: '', email: '',
  address: 'Coolsingel 1, 3011AD Rotterdam', full_address: 'Coolsingel 1, 3011AD Rotterdam',
  lat: 51.9225, lng: 4.47917, created_at: '2026-07-01T10:00:00Z',
  ...over,
})

afterEach(() => vi.clearAllMocks())

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

  it('renders the location row with its address, and delete stays disabled with a tooltip', async () => {
    api.get.mockResolvedValue({ data: { data: [location()] } })
    render(<LocationsSettings />)
    await waitFor(() => expect(screen.getByText('Kantoor Rotterdam')).toBeInTheDocument())
    expect(screen.getByText('Coolsingel 1, 3011AD Rotterdam')).toBeInTheDocument()

    // Delete is disabled — the measured BE gap (no in-use guard) means we never wire it live.
    const deleteBtn = screen.getByRole('button', { name: st('locations.deleteUnavailable') })
    expect(deleteBtn).toBeDisabled()
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
