/**
 * ShiftStaffingDrawer (SHIFT-STAFF-1) — asserts the REQUEST shape of each
 * mutation (candidate_id on assign, the exact cancel/checkout body), that the
 * 422 double-booking message (naming the clashing shift) renders verbatim, and
 * that the cancellation reason picker is fed by the real tenant lookup, never
 * a hardcoded list. `./hooks/useShiftStaffing` is mocked at the hook boundary
 * (mirrors AddShiftModal.test.tsx) — the hook's own request wiring is a plain
 * pass-through to `api.*`, nothing left to prove here beyond the call shape.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShiftStaffingDrawer from './ShiftStaffingDrawer'
import type { PlanningBoardShift } from './hooks/usePlanningBoard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts?.hours != null ? `${k}:${opts.hours}` : k) }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v, formatTime: (v: string) => v, locale: 'nl-NL' }) }))

const assignMutate   = vi.fn()
const unassignMutate = vi.fn()
const cancelMutate   = vi.fn()
const checkoutMutate = vi.fn()

const { mockEligible, mockReasons } = vi.hoisted(() => ({
  mockEligible: [{ id: 'c1', firstName: 'Fatima', lastName: 'El Amrani', favourite: true, reason: 'Available, no clashes' }],
  mockReasons: [{ value: 'client_cancelled', label: 'Client cancelled' }, { value: 'no_show', label: 'No show' }],
}))

vi.mock('./hooks/useShiftStaffing', () => ({
  useShiftEligibleCandidates: () => ({ candidates: mockEligible, loading: false, error: false }),
  usePlanningCancellationReasons: () => ({ reasons: mockReasons, loading: false }),
  useShiftStaffingMutations: () => ({
    assign:   { mutate: assignMutate,   isPending: false },
    unassign: { mutate: unassignMutate, isPending: false },
    cancel:   { mutate: cancelMutate,   isPending: false },
    checkout: { mutate: checkoutMutate, isPending: false },
  }),
}))

const baseShift = (over: Partial<PlanningBoardShift> = {}): PlanningBoardShift => ({
  id: 'shift-1', planningOrderId: null, function: 'Verzorgende IG', shiftType: 'day',
  startTime: '2026-08-20T07:00:00Z', endTime: '2026-08-20T15:00:00Z', status: 'open',
  numberPersons: 2, scheduledCount: 1, openSpots: 1, openShift: true,
  assigned: [{ scheduleId: 'sch-1', candidateId: 'cand-1', candidate: 'Jan de Vries', status: 'scheduled' }],
  customerId: null, customer: 'Zorgcentrum X', customerLocationId: null, location: 'Amsterdam',
  ...over,
})

describe('ShiftStaffingDrawer', () => {
  it('assigns a candidate from the eligible list with candidate_id', async () => {
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'staffing.assign' }))
    expect(assignMutate).toHaveBeenCalledWith('c1', expect.anything())
  })

  it('renders the eligible candidate favourite marker and the backend own reason text, never invented', () => {
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    expect(screen.getByText('Fatima El Amrani')).toBeInTheDocument()
    expect(screen.getByText('Available, no clashes')).toBeInTheDocument()
    expect(screen.getByLabelText('staffing.favourite')).toBeInTheDocument()
  })

  it('renders the 422 clashing-shift message from the server verbatim on an assign failure', async () => {
    assignMutate.mockImplementation((_id, opts) => {
      opts.onError({ response: { data: { errors: { candidate_id: ['This candidate is already scheduled on an overlapping shift (planning_shift_id abc-123, 2026-08-20T07:00:00Z–2026-08-20T15:00:00Z).'] } } } })
    })
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'staffing.assign' }))
    expect(await screen.findByText(/already scheduled on an overlapping shift \(planning_shift_id abc-123/)).toBeInTheDocument()
  })

  it('renders the 409 already-on-this-shift message verbatim', async () => {
    assignMutate.mockImplementation((_id, opts) => {
      opts.onError({ response: { data: { message: 'This candidate is already scheduled on this shift.' } } })
    })
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'staffing.assign' }))
    expect(await screen.findByText('This candidate is already scheduled on this shift.')).toBeInTheDocument()
  })

  it('unassigns via DELETE-style mutation with the schedule id', async () => {
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('staffing.unassign'))
    expect(unassignMutate).toHaveBeenCalledWith('sch-1', expect.anything())
  })

  it('cancels with a reason picked from the real tenant lookup, never a hardcoded list', async () => {
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('staffing.cancel'))
    expect(document.querySelector('select')).toBeNull()
    const picker = screen.getByRole('button', { name: 'staffing.cancelReasonPlaceholder' })
    await user.click(picker)
    await user.click(screen.getByText('Client cancelled'))
    await user.click(screen.getByRole('button', { name: /staffing.confirmCancel/ }))
    expect(cancelMutate).toHaveBeenCalledWith(
      { scheduleId: 'sch-1', status: 'cancelled', reason: 'client_cancelled' },
      expect.anything(),
    )
  })

  it('checks out with actual times and never a client-computed hours figure in the request', async () => {
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('staffing.checkout'))
    const startInput = screen.getByLabelText(/staffing.actualStart/)
    const endInput   = screen.getByLabelText(/staffing.actualEnd/)
    await user.clear(startInput)
    await user.type(startInput, '2026-08-20T07:05')
    await user.clear(endInput)
    await user.type(endInput, '2026-08-20T15:10')
    await user.click(screen.getByRole('button', { name: /staffing.confirmCheckout/ }))
    expect(checkoutMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: 'sch-1',
        actualStart: '2026-08-20T07:05',
        actualEnd: '2026-08-20T15:10',
      }),
      expect.anything(),
    )
    // No total-hours field is ever sent — the server computes and returns it.
    const call = checkoutMutate.mock.calls.at(-1)?.[0]
    expect(call).not.toHaveProperty('actualTotalHours')
    expect(call).not.toHaveProperty('hours')
  })

  it('shows the server-computed hours after checkout, never a recomputed client figure', async () => {
    checkoutMutate.mockImplementation((_vars, opts) => {
      opts.onSuccess({ id: 'sch-1', status: 'completed', actualStartTime: null, actualEndTime: null, actualBreakMinutes: null, actualTotalHours: 7.5, cancellationReason: null })
    })
    render(<ShiftStaffingDrawer shift={baseShift()} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByTitle('staffing.checkout'))
    await user.click(screen.getByRole('button', { name: /staffing.confirmCheckout/ }))
    expect(await screen.findByText('staffing.checkoutSaved:7.5')).toBeInTheDocument()
  })
})
