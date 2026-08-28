import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosPendingActionCard from './KoiosPendingActionCard'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import api from '@/lib/api'
import type { KoiosPendingAction } from './koiosTypes'

vi.mock('./koiosApi', () => ({ confirmPendingAction: vi.fn(), cancelPendingAction: vi.fn() }))
// useKoiosToolCapabilities fetches GET /ai/koios/capabilities directly via the axios client.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() }, unwrap: (r: { data: unknown }) => r.data }))
const mockConfirm = confirmPendingAction as unknown as ReturnType<typeof vi.fn>
const mockCancel = cancelPendingAction as unknown as ReturnType<typeof vi.fn>
const mockCapabilities = (api as unknown as { get: ReturnType<typeof vi.fn> }).get

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

// Renders inside a fresh QueryClientProvider so useKoiosToolCapabilities has a cache.
function renderCard(a: KoiosPendingAction) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><KoiosPendingActionCard action={a} /></QueryClientProvider>)
}

describe('KoiosPendingActionCard', () => {
  beforeEach(() => {
    mockConfirm.mockReset()
    mockCancel.mockReset()
    mockCapabilities.mockReset()
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

  it('disables Confirm and shows a connection-needed notice when the tool\'s connection is inactive', async () => {
    mockCapabilities.mockResolvedValue({
      data: { tools: [{ name: 'wijzig_kandidaat_status', connection_active: false, connection: 'whatsapp' }] },
    })
    renderCard(action())
    // The chip appears once capabilities resolve; the gate also disables during
    // the check itself, so wait for the RESOLVED state first.
    await screen.findByText('capabilities.connectionNeeded')
    expect(screen.getByText('koios.pendingAction.confirm')).toBeDisabled()
    // The badge deep-links to the integration's settings section — pin the hash.
    const link = screen.getByText('capabilities.connectionNeeded').closest('a')
    expect(link?.getAttribute('href')).toBe('#settings/whatsapp/whatsapp')
    // The reason also lives in the accessible tree, not only a title attr.
    expect(screen.getByText('koios.pendingAction.confirmDisabledConnection')).toBeInTheDocument()
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  // The gate never fails SILENTLY open: a failed capabilities check keeps confirm
  // usable (the server re-checks) but says so in the card.
  it('shows an honest unknown-status note when the capabilities check fails', async () => {
    mockCapabilities.mockRejectedValue(new Error('down'))
    renderCard(action())
    await waitFor(() => expect(screen.getByText('koios.pendingAction.connectionCheckUnknown')).toBeInTheDocument())
    expect(screen.getByText('koios.pendingAction.confirm')).toBeEnabled()
  })

  // REFUSAL-CONVENTION-1 definitive (BuildsToolResult): gelukt:true + onthouden[]
  // = a PARTIAL execution — its own honest state, never a bare "Bevestigd" and
  // never a full refusal either (the record DID land, only the mail was withheld).
  it('renders the partial state when gelukt=true with onthouden + reden (mail withheld)', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { gelukt: true, onthouden: ['mail'], reden: 'no_email_consent' } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'partial'))
    expect(screen.getByText('koios.pendingAction.partialTitle')).toBeInTheDocument()
    expect(screen.queryByText('koios.pendingAction.confirmed')).not.toBeInTheDocument()
  })

  // A full refusal under the definitive convention: gelukt:false + reden + fout.
  it('renders refused on gelukt=false with a reden slug', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { gelukt: false, reden: 'customer_blocked', fout: 'Klant is geblokkeerd.' } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.queryByText('koios.pendingAction.confirmed')).not.toBeInTheDocument()
  })

  // MEASURED shape 2 (StartInterview): a fout sentence + reden slug — the slug
  // drives the translation, the prose is only the untranslated fallback.
  it('renders the refusal for the fout+reden shape and never a false confirmed', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { fout: 'Interview kon niet starten.', reden: 'no_mobile_or_consent' } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.queryByText('koios.pendingAction.confirmed')).not.toBeInTheDocument()
  })
})
