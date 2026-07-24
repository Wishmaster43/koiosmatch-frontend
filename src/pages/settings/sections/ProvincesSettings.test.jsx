/**
 * ProvincesSettings — covers the country-scoped fetch (GET ?country=NL), the
 * add flow POSTing the selected country, and the 409-keeps-row-in-use delete
 * guard (mirrors AppointmentLocationSettings/MatchTemplatesSettings).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ProvincesSettings from './ProvincesSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })
// Same, for the shared ConfirmDialog's own labels (common namespace).
const ct = (key, opts) => i18n.t(key, { ns: 'common', ...opts })

const province = (over = {}) => ({ id: 'p1', country: 'NL', name: 'Utrecht', position: 0, active: true, in_use: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('ProvincesSettings', () => {
  it('loads the default NL country and renders its provinces', async () => {
    api.get.mockResolvedValue({ data: [province()] })
    render(<ProvincesSettings />)

    await screen.findByText('Utrecht')
    expect(api.get).toHaveBeenCalledWith('/provinces', { params: { country: 'NL' } })
  })

  it('shows the error state with a retry that re-fetches', async () => {
    api.get.mockRejectedValueOnce(new Error('network down'))
    render(<ProvincesSettings />)

    await screen.findByText(st('provinces.loadError'))
    api.get.mockResolvedValueOnce({ data: [province()] })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: st('provinces.retry') }))

    await screen.findByText('Utrecht')
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state for a country with no seeded provinces', async () => {
    api.get.mockResolvedValue({ data: [] })
    render(<ProvincesSettings />)

    await screen.findByText(st('provinces.empty'))
  })

  it('adding a province POSTs the selected country with the typed name', async () => {
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: province({ id: 'p2', name: 'Zuid-Holland' }) })
    const user = userEvent.setup()
    render(<ProvincesSettings />)

    await screen.findByText(st('provinces.empty'))
    await user.click(screen.getByRole('button', { name: st('provinces.add') }))
    await user.type(screen.getByLabelText(st('statusList.nameLabel')), 'Zuid-Holland')
    await user.click(screen.getByRole('button', { name: st('statusList.addBtn') }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/provinces', { country: 'NL', name: 'Zuid-Holland' }))
    expect(await screen.findByText('Zuid-Holland')).toBeInTheDocument()
  })

  it('a 409 on delete keeps the row and flags it in-use instead of removing it', async () => {
    api.get.mockResolvedValue({ data: [province()] })
    api.delete.mockRejectedValue({ response: { status: 409 } })
    const user = userEvent.setup()
    render(<ProvincesSettings />)

    await screen.findByText('Utrecht')
    // Row layout is [name, edit, delete] — delete is reliably the last button.
    const row = screen.getByText('Utrecht').closest('div')
    const rowButtons = row.querySelectorAll('button')
    await user.click(rowButtons[rowButtons.length - 1])
    // Confirm the delete via the shared ConfirmDialog.
    await user.click(await screen.findByRole('button', { name: ct('confirm') }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/provinces/p1'))
    expect(screen.getByText('Utrecht')).toBeInTheDocument()
  })
})
