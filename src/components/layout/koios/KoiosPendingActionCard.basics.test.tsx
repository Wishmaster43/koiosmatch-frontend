/** KoiosPendingActionCard: rendering, confirm/cancel flow, expiry and formatting. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosPendingActionCard from './KoiosPendingActionCard'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import api from '@/lib/api'
import type { KoiosPendingAction } from './koiosTypes'
import { action } from './KoiosPendingActionCard.testKit'
import { useNavigation } from '@/context/NavigationContext'

vi.mock('./koiosApi', () => ({ confirmPendingAction: vi.fn(), cancelPendingAction: vi.fn() }))
// KOIOS-DEDUPE-FE-1: the existing-record chip navigates via openEntity (cross-entity intent).
vi.mock('@/context/NavigationContext', () => ({ useNavigation: vi.fn() }))
// useKoiosToolCapabilities fetches GET /ai/koios/capabilities directly via the axios client.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() }, unwrap: (r: { data: unknown }) => r.data }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string; count?: number }) => (k === 'koios.pendingAction.reasons.send_failed' ? 'Sending failed.' : null) ?? opts?.defaultValue ?? (opts?.count != null ? `${k}|${opts.count}` : k), i18n: { exists: () => false } }) }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
// PROPOSAL-CV-PANEL-1: the lazy host that wraps the shared ensure hook is mocked (the hook renders a PDF and fetches).
const mockEnsure = vi.fn()
vi.mock('./EnsureProposalCvHost', async () => {
  const { useEffect } = await import('react')
  const Host = ({ onReady }: { onReady: (fn: unknown) => void }) => { useEffect(() => { onReady(mockEnsure); return () => onReady(null) }, [onReady]); return null }
  return { default: Host }
})
const mockConfirm = confirmPendingAction as unknown as ReturnType<typeof vi.fn>
const mockCancel = cancelPendingAction as unknown as ReturnType<typeof vi.fn>
const mockCapabilities = (api as unknown as { get: ReturnType<typeof vi.fn> }).get
const mockOpenEntity = vi.fn()

// Renders inside a fresh QueryClientProvider so useKoiosToolCapabilities has a cache.
function renderCard(a: KoiosPendingAction) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><KoiosPendingActionCard action={a} /></QueryClientProvider>)
}

describe('KoiosPendingActionCard', () => {
  beforeEach(() => {
    mockConfirm.mockReset()
    mockCancel.mockReset()
    mockEnsure.mockReset()
    mockCapabilities.mockReset()
    mockOpenEntity.mockReset()
    ;(useNavigation as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ openEntity: mockOpenEntity })
    // Default: capabilities has no matching tool entry (no connection gate applies).
    mockCapabilities.mockResolvedValue({ data: { tools: [] } })
  })
  afterEach(() => { vi.useRealTimers() })

  it('renders the title, entity chip and preview rows', () => {
    renderCard(action())
    expect(screen.getByText('Status wijzigen naar Niet beschikbaar')).toBeInTheDocument()
    expect(screen.getByText('Ahmed Vos')).toBeInTheDocument()
    expect(screen.getByText('Beschikbaar → Niet beschikbaar')).toBeInTheDocument()
  })

  it('surfaces an owner preview row next to the chip', () => {
    renderCard(action({ preview: [{ label: 'Eigenaar', after: 'Jill' }] }))
    expect(screen.getByText(/koios\.pendingAction\.owner/)).toBeInTheDocument()
  })

  it('shows the shared matrix warning banner when present', () => {
    renderCard(action({ warning: { popup_code: 'P3', message: 'Kandidaat is ziek.' } }))
    expect(screen.getByTestId('action-rule-banner')).toHaveAttribute('data-effect', 'warn')
    expect(screen.getByText('Kandidaat is ziek.')).toBeInTheDocument()
  })

  it('confirms a non-destructive action in one step', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { gelukt: true } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    expect(mockConfirm).toHaveBeenCalledWith('pa1')
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'confirmed'))
    expect(screen.getByText('koios.pendingAction.confirmed')).toBeInTheDocument()
    // Buttons are gone once resolved.
    expect(screen.queryByText('koios.pendingAction.confirm')).not.toBeInTheDocument()
  })

  it('requires a second confirm step for a destructive action, with a "back" that does not call the API', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { gelukt: true } })
    const user = userEvent.setup()
    renderCard(action({ destructive: true }))
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
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.cancel'))
    expect(mockCancel).toHaveBeenCalledWith('pa1')
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'cancelled'))
    expect(screen.getByText('koios.pendingAction.cancelled')).toBeInTheDocument()
  })

  it('renders an honest "expired" state on a 410/404/422 confirm response', async () => {
    mockConfirm.mockRejectedValue({ response: { status: 410 } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'expired'))
    expect(screen.getByText('koios.pendingAction.expired')).toBeInTheDocument()
  })

  // KOIOS-CONFIRM-DECLINE-1 (PRIJSMODEL-C 30-08): a genuine tool refusal is now
  // a 422 { status: 'declined', message, data: { budget? } } — must land on
  // 'refused' with the server message + budget, NEVER the generic 'expired'
  // state a bare 422 used to fall into.
  it('renders refused (never expired) on a 422 declined response, with the staffel stand', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: {
        status: 'declined', message: 'Je AI-staffel is vol.',
        data: { budget: { state: 'blocked', allowance: 100, used: 100, remaining: 0, unit: 'koios_ai_token', upgrade_hint: { next_tier_label: 'Pro' } } },
      } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('Je AI-staffel is vol.')).toBeInTheDocument()
    expect(screen.getByText(/koios\.pendingAction\.upgradeHint/)).toBeInTheDocument()
    expect(screen.queryByText('koios.pendingAction.expired')).not.toBeInTheDocument()
  })

  // Any non-duplicate decline translates its stable reason slug, never the BE's English prose.
  it('translates a declined response by its reason slug instead of the raw server message', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: { status: 'declined', message: 'Candidate not found.', data: { ok: false, reason: 'send_failed' } } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('Sending failed.')).toBeInTheDocument()
    expect(screen.queryByText('Candidate not found.')).not.toBeInTheDocument()
  })

  it('falls back to the server message when the decline slug is unknown', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: { status: 'declined', message: 'Candidate not found.', data: { reason: 'brand_new_slug' } } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('Candidate not found.')).toBeInTheDocument()
  })

  it('renders a generic error state on an unrelated failure', async () => {
    mockConfirm.mockRejectedValue({ response: { status: 500 } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'error'))
  })

  it('auto-expires once the countdown reaches zero', async () => {
    vi.useFakeTimers()
    renderCard(action({ expires_at: new Date(Date.now() + 2000).toISOString() }))
    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
    expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'expired')
  })

  // KOIOS-PENDING-CARD-FACE-1: the seconds countdown is a developer face
  // (Danny 28-09: "Hoezo expires in zoveel seconden?") — the card shows minutes.
  it('shows the countdown in minutes, rounded up (891s → 15 min)', () => {
    vi.useFakeTimers()
    renderCard(action({ expires_at: new Date(Date.now() + 891_000).toISOString() }))
    expect(screen.getByText('koios.pendingAction.expiresIn|15')).toBeInTheDocument()
  })

  it('shows "expires within a minute" under 60s left', () => {
    vi.useFakeTimers()
    renderCard(action({ expires_at: new Date(Date.now() + 45_000).toISOString() }))
    expect(screen.getByText('koios.pendingAction.expiresSoon')).toBeInTheDocument()
  })

  it('renders the title once when the entity chip would only repeat it', () => {
    renderCard(action({ title: 'Taak aanmaken: Belafspraak Bas Koster', entity_ref: { type: 'candidate', id: 'c1', label: 'Taak aanmaken: Belafspraak Bas Koster' } }))
    expect(screen.getAllByText('Taak aanmaken: Belafspraak Bas Koster')).toHaveLength(1)
  })

  it('hides id/UUID rows, humanises the date and shows the confidence caption', () => {
    renderCard(action({
      title: 'Taak aanmaken: Belafspraak Bas Koster',
      entity_ref: { type: 'candidate', id: 'c1', label: 'Taak aanmaken: Belafspraak Bas Koster' },
      preview: [
        { label: 'titel', text: 'Belafspraak Bas Koster' },
        { label: 'deadline', text: '2026-09-29' },
        { label: 'kandidaat_id', text: '67742906-cb41-43d0-9a59-320c80da0923' },
        { label: 'kandidaat', text: 'Bas Koster' },
        { label: 'omschrijving', text: 'Belafspraak inplannen' },
        { label: 'zekerheid', text: 'hoog' },
      ],
    }))
    expect(screen.queryByText(/kandidaat_id/)).not.toBeInTheDocument()
    expect(screen.queryByText(/67742906-cb41-43d0-9a59-320c80da0923/)).not.toBeInTheDocument()
    expect(screen.getByText('29-09-2026')).toBeInTheDocument()
    expect(screen.getByText(/koios\.pendingAction\.confidence\.label/)).toBeInTheDocument()
  })
})
