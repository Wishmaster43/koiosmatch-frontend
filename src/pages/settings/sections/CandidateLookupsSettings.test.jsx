/**
 * CandidateLookupsSettings — funnel-stage singleton `is_default` flip
 * (LOOKUP-DEFAULT-1, api 4c25677). Only the funnel_types block carries the
 * DefaultToggle; contract forms / statuses / phases must not render it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { FunnelStagesSettings, ContractFormsSettings } from './CandidateLookupsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const st = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const stage = (over = {}) => ({ id: 'f1', value: 'applied', label: 'Gesolliciteerd', color: '#3B8FD4', is_default: false, ...over })

afterEach(() => vi.clearAllMocks())

describe('CandidateLookupsSettings — funnel stage default singleton', () => {
  it('shows the DefaultToggle on funnel stages, with the seeded default disabled', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    render(<FunnelStagesSettings />)

    const activePill = await screen.findByRole('button', { name: st('common.default') })
    expect(activePill).toBeDisabled()
    expect(screen.getByRole('button', { name: st('common.setDefault') })).not.toBeDisabled()
  })

  it('promoting a funnel stage PUTs is_default:true and clears the previous default optimistically', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    api.put.mockResolvedValue({ data: {} })
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Aangenomen')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/funnel-types/f2', expect.objectContaining({ is_default: true })))
    await waitFor(() => expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1))
  })

  // Audit r4: a failed default-flip must revert AND tell the user (the revert
  // alone read as "saved" — the siblings updateColor/reorder already notify).
  it('reverts the default flip and notifies when the PUT fails', async () => {
    api.get.mockResolvedValue({ data: {
      funnel_types: [stage({ id: 'f1', label: 'Gesolliciteerd', is_default: true }), stage({ id: 'f2', label: 'Aangenomen', value: 'hired' })],
    } })
    api.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    render(<FunnelStagesSettings />)

    await screen.findByText('Aangenomen')
    await user.click(screen.getByRole('button', { name: st('common.setDefault') }))

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
    // Reverted: f1 is the default again; f2 offers "make default" once more.
    await waitFor(() => expect(screen.getByRole('button', { name: st('common.setDefault') })).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: st('common.default') })).toHaveLength(1)
  })

  it('does not render the DefaultToggle on the contract-forms (candidate_types) block', async () => {
    api.get.mockResolvedValue({ data: {
      candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' }],
    } })
    render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    expect(screen.queryByRole('button', { name: st('common.default') })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: st('common.setDefault') })).not.toBeInTheDocument()
  })
})

// Audit finding: updateColor/reorder used to be optimistic-with-no-revert (a
// failed PUT looked like it had succeeded, silently swallowed by catch {}).
// Both now revert the optimistic state and notify the user (§13 — assert the
// request AND the rolled-back state, never only that a callback fired).
describe('CandidateLookupsSettings — colour + reorder revert on failure', () => {
  it('reverts the colour and notifies when the colour PUT fails', async () => {
    api.get.mockResolvedValue({ data: { candidate_types: [{ id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' }] } })
    api.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const user = userEvent.setup()
    const { container } = render(<ContractFormsSettings />)

    await screen.findByText('ZZP')
    // The ColorSwatch trigger is an unlabelled button whose own background IS the
    // current colour — select it by that inline style instead of an accessible name.
    const swatchBtn = container.querySelector('button[style*="rgb(59, 143, 212)"]')
    await user.click(swatchBtn)
    const preset = container.querySelector('button[style*="rgb(100, 116, 139)"]') // first preset, #64748B
    await user.click(preset)

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/c1', { label: 'ZZP', color: '#64748B' }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
    // Reverted: the swatch shows the original colour again, not the rejected one.
    expect(container.querySelector('button[style*="rgb(59, 143, 212)"]')).toBeTruthy()
  })

  it('reverts the order and notifies when the reorder PUT fails', async () => {
    api.get.mockResolvedValue({ data: { candidate_types: [
      { id: 'c1', value: 'zzp', label: 'ZZP', color: '#3B8FD4' },
      { id: 'c2', value: 'payroll', label: 'Payroll', color: '#6E8FD6' },
    ] } })
    api.put.mockRejectedValue(new Error('network down'))
    const { notifyError } = await import('@/lib/notify')
    const { container } = render(<ContractFormsSettings />)

    await screen.findByText('Payroll')
    const rows = container.querySelectorAll('[draggable="true"]')
    expect(rows).toHaveLength(2)

    // Drag row 0 (ZZP) onto row 1 (Payroll) to swap their order.
    fireEvent.dragStart(rows[0])
    fireEvent.dragOver(rows[1])
    fireEvent.drop(rows[1])
    fireEvent.dragEnd(rows[0])

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/settings/candidate-lookups/candidate-types/reorder', { ids: ['c2', 'c1'] }))
    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(st('statusList.saveFailed')))
    // Reverted: ZZP is back in its original (first) position.
    const revertedRows = container.querySelectorAll('[draggable="true"]')
    expect(revertedRows[0]).toHaveTextContent('ZZP')
  })
})
