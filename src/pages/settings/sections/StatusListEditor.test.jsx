/**
 * StatusListEditor — singleton `is_default` flip (LOOKUP-DEFAULT-1, api 4c25677).
 * Covers the DefaultToggle promotion: clicking "Maak standaard" on a non-default
 * row optimistically clears every other row's flag, PUTs the promoted row, and
 * rolls the optimistic flip back if the backend rejects it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import StatusListEditor from './StatusListEditor'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const type = (over = {}) => ({ id: 't1', name: 'Intake', color: '#3B8FD4', is_default: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('StatusListEditor — defaultField singleton', () => {
  it('renders the current default as a non-interactive "Standaard" pill and the rest as clickable "Maak standaard"', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).toBeDisabled()
    const promoteBtn = screen.getByRole('button', { name: st('common.setDefault') })
    expect(promoteBtn).not.toBeDisabled()
  })

  it('promoting a row PUTs is_default:true for it and optimistically clears the previous default', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    await screen.findByText('Kennismaking')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    // The promoted row is sent is_default:true; nothing on the previous default is re-sent.
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/appointment-types/t2', expect.objectContaining({ is_default: true })))
    // Optimistic UI: now exactly one "Standaard" pill (t2) and one "Maak standaard" (t1).
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
    expect(screen.getByRole('button', { name: st('common.setDefault') })).toBeInTheDocument()
  })

  it('rolls back the optimistic flip when the backend rejects the promotion', async () => {
    api.get.mockResolvedValue({ data: [type({ id: 't1', name: 'Intake', is_default: true }), type({ id: 't2', name: 'Kennismaking' })] })
    api.put.mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()
    render(<StatusListEditor title="Afspraaktypes" subtitle="" endpoint="/appointment-types" addLabel="Toevoegen"
      defaultField={{ key: 'is_default' }} />)

    await screen.findByText('Kennismaking')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    // After the rejected PUT, the original default (Intake) is restored.
    await waitFor(() => expect(api.put).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
    const rows = screen.getAllByRole('button', { name: st('common.default') })
    expect(rows[0]).toBeInTheDocument()
    // Intake's row still shows the disabled "Standaard" pill (rollback succeeded).
    expect(screen.getByText('Intake').closest('div')).toBeTruthy()
  })
})
