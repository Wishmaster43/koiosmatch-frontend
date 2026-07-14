import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosPendingActionCard from './KoiosPendingActionCard'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import type { KoiosPendingAction } from './koiosTypes'

vi.mock('./koiosApi', () => ({ confirmPendingAction: vi.fn(), cancelPendingAction: vi.fn() }))
const mockConfirm = confirmPendingAction as unknown as ReturnType<typeof vi.fn>
const mockCancel = cancelPendingAction as unknown as ReturnType<typeof vi.fn>

// A mocked pending_action shape, mirroring the KOIOS-AGENT-PLAN §6 wire contract
// (dormant on the real backend — this is exactly what the FE half is built against).
const action = (over: Partial<KoiosPendingAction> = {}): KoiosPendingAction => ({
  id: 'pa1',
  tool: 'wijzig_kandidaat_status',
  title: 'Status wijzigen naar Niet beschikbaar',
  entity_ref: { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
  preview: [{ label: 'Status', before: 'Beschikbaar', after: 'Niet beschikbaar' }],
  destructive: false,
  expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  ...over,
})

describe('KoiosPendingActionCard', () => {
  beforeEach(() => { mockConfirm.mockReset(); mockCancel.mockReset() })
  afterEach(() => { vi.useRealTimers() })

  it('renders the title, entity chip and preview rows', () => {
    render(<KoiosPendingActionCard action={action()} />)
    expect(screen.getByText('Status wijzigen naar Niet beschikbaar')).toBeInTheDocument()
    expect(screen.getByText('Ahmed Vos')).toBeInTheDocument()
    expect(screen.getByText('Beschikbaar → Niet beschikbaar')).toBeInTheDocument()
  })

  it('surfaces an owner preview row next to the chip', () => {
    render(<KoiosPendingActionCard action={action({ preview: [{ label: 'Eigenaar', after: 'Jill' }] })} />)
    expect(screen.getByText(/koios\.pendingAction\.owner/)).toBeInTheDocument()
  })

  it('shows the shared matrix warning banner when present', () => {
    render(<KoiosPendingActionCard action={action({ warning: { popup_code: 'P3', message: 'Kandidaat is ziek.' } })} />)
    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'warn')
    expect(screen.getByText('Kandidaat is ziek.')).toBeInTheDocument()
  })

  it('confirms a non-destructive action in one step', async () => {
    mockConfirm.mockResolvedValue({})
    const user = userEvent.setup()
    render(<KoiosPendingActionCard action={action()} />)
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    expect(mockConfirm).toHaveBeenCalledWith('pa1')
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'confirmed'))
    expect(screen.getByText('koios.pendingAction.confirmed')).toBeInTheDocument()
    // Buttons are gone once resolved.
    expect(screen.queryByText('koios.pendingAction.confirm')).not.toBeInTheDocument()
  })

  it('requires a second confirm step for a destructive action, with a "back" that does not call the API', async () => {
    mockConfirm.mockResolvedValue({})
    const user = userEvent.setup()
    render(<KoiosPendingActionCard action={action({ destructive: true })} />)
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('koios.pendingAction.confirmFinal')).toBeInTheDocument()

    // "Back" steps out of the destructive confirm WITHOUT hitting the API.
    await user.click(screen.getByText('koios.pendingAction.back'))
    expect(mockCancel).not.toHaveBeenCalled()
    expect(screen.getByText('koios.pendingAction.confirm')).toBeInTheDocument()

    // Now actually confirm.
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await user.click(screen.getByText('koios.pendingAction.confirmFinal'))
    expect(mockConfirm).toHaveBeenCalledWith('pa1')
  })

  it('cancels a proposal server-side', async () => {
    mockCancel.mockResolvedValue({})
    const user = userEvent.setup()
    render(<KoiosPendingActionCard action={action()} />)
    await user.click(screen.getByText('koios.pendingAction.cancel'))
    expect(mockCancel).toHaveBeenCalledWith('pa1')
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'cancelled'))
    expect(screen.getByText('koios.pendingAction.cancelled')).toBeInTheDocument()
  })

  it('renders an honest "expired" state on a 410/404/422 confirm response', async () => {
    mockConfirm.mockRejectedValue({ response: { status: 410 } })
    const user = userEvent.setup()
    render(<KoiosPendingActionCard action={action()} />)
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'expired'))
    expect(screen.getByText('koios.pendingAction.expired')).toBeInTheDocument()
  })

  it('renders a generic error state on an unrelated failure', async () => {
    mockConfirm.mockRejectedValue({ response: { status: 500 } })
    const user = userEvent.setup()
    render(<KoiosPendingActionCard action={action()} />)
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'error'))
  })

  it('auto-expires once the countdown reaches zero', async () => {
    vi.useFakeTimers()
    render(<KoiosPendingActionCard action={action({ expires_at: new Date(Date.now() + 2000).toISOString() })} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
    expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'expired')
  })
})
