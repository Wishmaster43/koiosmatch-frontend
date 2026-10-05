import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosPendingActionCard from './KoiosPendingActionCard'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import api from '@/lib/api'
import type { KoiosPendingAction } from './koiosTypes'
import { useNavigation } from '@/context/NavigationContext'

vi.mock('./koiosApi', () => ({ confirmPendingAction: vi.fn(), cancelPendingAction: vi.fn() }))
// KOIOS-DEDUPE-FE-1: the existing-record chip navigates via openEntity (cross-entity intent).
vi.mock('@/context/NavigationContext', () => ({ useNavigation: vi.fn() }))
// useKoiosToolCapabilities fetches GET /ai/koios/capabilities directly via the axios client.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() }, unwrap: (r: { data: unknown }) => r.data }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string; count?: number }) => opts?.defaultValue ?? (opts?.count != null ? `${k}|${opts.count}` : k) }) }))
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))
const mockConfirm = confirmPendingAction as unknown as ReturnType<typeof vi.fn>
const mockCancel = cancelPendingAction as unknown as ReturnType<typeof vi.fn>
const mockCapabilities = (api as unknown as { get: ReturnType<typeof vi.fn> }).get
const mockOpenEntity = vi.fn()

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

  // NOTE-TITLE-1: proposal_not_allowed refusal slug for blocked/archived candidates
  // KOIOS-DEDUPE-1: a duplicate-twin decline carries `data.code`/`data.ref` —
  // the refused callout shows an existing-record chip when `ref` is present.
  it('renders an existing-record chip on a duplicate decline with a ref, translated via the code (not the BE english fallback message)', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: {
        status: 'declined', message: 'This candidate already exists.',
        data: { code: 'duplicate_candidate', ref: { type: 'candidate', id: 'c9', archived: false } },
      } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('notesAssist.execute.declined.duplicate')).toBeInTheDocument()
    expect(screen.queryByText('This candidate already exists.')).not.toBeInTheDocument()
    expect(screen.getByText('koios.pendingAction.openExisting')).toBeInTheDocument()
  })

  // KOIOS-DEDUPE-FE-1 verifier fix: the chip deep-links to the EXACT ref target.
  it('navigates to the existing record via openEntity when the chip is clicked', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: {
        status: 'declined', message: 'This candidate already exists.',
        data: { code: 'duplicate_candidate', ref: { type: 'candidate', id: 'c9', archived: false } },
      } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    await user.click(screen.getByText('koios.pendingAction.openExisting'))
    expect(mockOpenEntity).toHaveBeenCalledWith('candidates', 'c9')
  })

  it('renders an archived suffix on the existing-record chip when ref.archived is true', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: {
        status: 'declined', message: 'This vacancy already exists and is archived.',
        data: { code: 'duplicate_vacancy_archived', ref: { type: 'vacancy', id: 'v9', archived: true } },
      } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('notesAssist.execute.declined.duplicate_archived')).toBeInTheDocument()
    expect(screen.getByText('koios.pendingAction.existingArchived')).toBeInTheDocument()
  })

  it('renders no existing-record chip on a declined response without a ref (no view rights)', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: {
        status: 'declined', message: 'This customer already exists.',
        data: { code: 'duplicate_customer' },
      } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.getByText('notesAssist.execute.declined.duplicate')).toBeInTheDocument()
    expect(screen.queryByText('koios.pendingAction.openExisting')).not.toBeInTheDocument()
  })

  // Verifier fix: no page mapping for the ref's type (e.g. a bare location/contact/
  // department ref with no `parent`) must never render a dead non-clickable chip.
  it('renders no existing-record chip when the ref type has no mapped page', async () => {
    mockConfirm.mockRejectedValue({
      response: { status: 422, data: {
        status: 'declined', message: 'This location already exists.',
        data: { code: 'duplicate_location', ref: { type: 'location', id: 'l1', archived: false } },
      } },
    })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.queryByText('koios.pendingAction.openExisting')).not.toBeInTheDocument()
  })

  it('renders refused on proposal_not_allowed slug', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { gelukt: false, reden: 'proposal_not_allowed' } })
    const user = userEvent.setup()
    renderCard(action())
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'refused'))
    expect(screen.queryByText('koios.pendingAction.confirmed')).not.toBeInTheDocument()
  })

  // CALLLIST-KEY-1: a create_call_list result shows the created/reused list as a
  // deep-link chip, plus any reuse channel/owner warnings (English, from the server).
  it('renders the created call list as a deep-link chip on confirm', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { ok: true, call_list_id: 'cl-1', name: 'Bellijst Noord' } })
    const user = userEvent.setup()
    renderCard(action({ tool: 'create_call_list' }))
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'confirmed'))
    expect(screen.getByText('Bellijst Noord')).toBeInTheDocument()
  })

  it('renders the reuse warnings list under the chip when present', async () => {
    mockConfirm.mockResolvedValue({
      status: 'executed',
      data: { ok: true, call_list_id: 'cl-1', name: 'Bellijst Noord', reused: true, warnings: ['channel not applied: an existing list keeps its own channel'] },
    })
    const user = userEvent.setup()
    renderCard(action({ tool: 'create_call_list' }))
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'confirmed'))
    expect(screen.getByText('koios.pendingAction.warnings')).toBeInTheDocument()
    expect(screen.getByText('channel not applied: an existing list keeps its own channel')).toBeInTheDocument()
  })

  it('shows no warnings block when the server sent none', async () => {
    mockConfirm.mockResolvedValue({ status: 'executed', data: { ok: true, call_list_id: 'cl-1', name: 'Bellijst Noord' } })
    const user = userEvent.setup()
    renderCard(action({ tool: 'create_call_list' }))
    await user.click(screen.getByText('koios.pendingAction.confirm'))
    await waitFor(() => expect(screen.getByTestId('koios-pending-action')).toHaveAttribute('data-status', 'confirmed'))
    expect(screen.queryByText('koios.pendingAction.warnings')).not.toBeInTheDocument()
  })
})
