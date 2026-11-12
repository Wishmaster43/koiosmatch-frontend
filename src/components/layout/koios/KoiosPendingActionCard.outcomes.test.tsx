/** KoiosPendingActionCard: connection gate, result shapes and the propose CV flow. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string; count?: number }) => (k === 'koios.pendingAction.reasons.send_failed' ? 'Sending failed.' : null) ?? opts?.defaultValue ?? (opts?.count != null ? `${k}|${opts.count}` : k) }) }))
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

  // KOIOS-EN-1 phase B: an English-only refusal shape ({ ok: false, reason, error })
  // resolves exactly like its Dutch twin (English-first, Dutch-fallback `pick`).
  it('renders refused on an English-only ok=false + reason shape', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { ok: false, reason: 'customer_blocked', error: 'Customer is blocked.' } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.queryByText('koios.pendingAction.confirmed')).not.toBeInTheDocument()
  })

  // Y-002: a proposal without a stored CV declines with a code that renders its own key.
  it('renders the proposal_cv_required key on that decline code, not the BE prose', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: { status: 'declined', message: 'CV required.', data: { ok: false, reason: 'proposal_cv_required', error: 'CV required.' } } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('notesAssist.execute.declined.proposal_cv_required')).toBeInTheDocument()
    expect(screen.queryByText('CV required.')).not.toBeInTheDocument()
  })

  const proposeAction = () => action({ tool: 'propose_application', entity_ref: { type: 'application', id: 'a1', label: 'Voorstel', application_id: 'app1' } })

  it('ensures the proposal CV then POSTs the confirm with {cv_document_id} for a propose action', async () => {
    mockEnsure.mockResolvedValue('d1')
    mockConfirm.mockResolvedValue({ status: 'executed', data: { ok: true } })
    const user = userEvent.setup()
    renderCard(proposeAction())
    await waitFor(() => expect(screen.getByText('koios.pendingAction.confirm').closest('button')).toBeEnabled())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'confirmed'))
    expect(mockEnsure).toHaveBeenCalledWith('app1')
    expect(mockConfirm).toHaveBeenCalledWith('pa1', { cv_document_id: 'd1' })
  })

  it('confirms a non-propose action with no body and never prepares a CV', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { ok: true } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('pa1'))
    expect(mockEnsure).not.toHaveBeenCalled()
  })

  it('shows the preparing caption while the CV is being made', async () => {
    mockEnsure.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderCard(proposeAction())
    await waitFor(() => expect(screen.getByText('koios.pendingAction.confirm').closest('button')).toBeEnabled())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    expect(await screen.findByText('notesAssist.proposeCv.preparing')).toBeInTheDocument()
  })

  it('shows the refused face with the prepare message and does not POST when the CV preparation fails', async () => {
    mockEnsure.mockRejectedValue(new Error('prepare failed text'))
    const user = userEvent.setup()
    renderCard(proposeAction())
    await waitFor(() => expect(screen.getByText('koios.pendingAction.confirm').closest('button')).toBeEnabled())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('prepare failed text')).toBeInTheDocument()
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('keeps the card pending and shows the invalid-override key on a 422 invalid_override, allowing a retry', async () => {
    mockEnsure.mockResolvedValue('d1')
    mockConfirm.mockRejectedValueOnce({ response: { status: 422, data: { status: 'invalid_override', code: 'proposal_cv_invalid', message: 'x' } } })
    mockConfirm.mockResolvedValueOnce({ status: 'executed', data: { ok: true } })
    const user = userEvent.setup()
    renderCard(proposeAction())
    await waitFor(() => expect(screen.getByText('koios.pendingAction.confirm').closest('button')).toBeEnabled())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    expect(await screen.findByText('notesAssist.execute.declined.proposal_cv_invalid')).toBeInTheDocument()
    expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'proposed')
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'confirmed'))
    expect(mockConfirm).toHaveBeenCalledTimes(2)
  })

  it('renders the contact_required key on that decline code, not the BE prose', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: { status: 'declined', message: 'Contact required.', data: { ok: false, reason: 'contact_required', error: 'CV required.' } } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('notesAssist.execute.declined.contact_required')).toBeInTheDocument()
    expect(screen.queryByText('CV required.')).not.toBeInTheDocument()
  })
})
