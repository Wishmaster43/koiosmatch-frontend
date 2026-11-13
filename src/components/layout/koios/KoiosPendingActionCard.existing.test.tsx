/** KoiosPendingActionCard: duplicate declines, existing-record chip and call list result. */
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
