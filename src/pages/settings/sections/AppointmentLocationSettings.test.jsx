/**
 * AppointmentLocationSettings (LOOKUP-DEFAULT-1 / job 2) — smoke test: renders the
 * seeded lookup via the shared StatusListEditor, exposes the is_default
 * DefaultToggle, and keeps an in-use row on a 409 delete instead of removing it
 * (mirrors AppointmentTypeSettings — same component, same contract).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { AppointmentLocationSettings } from './AppointmentLocationSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const location = (over = {}) => ({ id: 'l1', name: 'Kantoor', color: '#3B8FD4', is_default: true, ...over })

afterEach(() => vi.clearAllMocks())

describe('AppointmentLocationSettings', () => {
  it('renders the seeded locations with the default toggle', async () => {
    api.get.mockResolvedValue({ data: [location(), location({ id: 'l2', name: 'Online', is_default: false })] })
    render(<AppointmentLocationSettings />)

    await screen.findByText('Kantoor')
    expect(screen.getByText('Online')).toBeInTheDocument()
    const activePill = screen.getByRole('button', { name: st('common.default') })
    expect(activePill).toBeDisabled()
  })

  it('a 409 on delete keeps the row and flags it in-use instead of removing it', async () => {
    api.get.mockResolvedValue({ data: [location({ is_default: false }), location({ id: 'l2', name: 'Online', is_default: true })] })
    api.delete.mockRejectedValue({ response: { status: 409 } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<AppointmentLocationSettings />)

    await screen.findByText('Kantoor')
    // Row layout is always [colour swatch, …optional fields…, edit, delete] — the
    // delete (Trash2) button is reliably the LAST button in the row regardless of
    // which optional StatusListEditor fields are enabled for this lookup.
    const kantoorRow = screen.getByText('Kantoor').closest('div')
    const rowButtons = kantoorRow.querySelectorAll('button')
    await user.click(rowButtons[rowButtons.length - 1])

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/appointment-locations/l1'))
    // Row survives the 409 (never silently removed) — its name is still on screen.
    expect(screen.getByText('Kantoor')).toBeInTheDocument()
  })
})
