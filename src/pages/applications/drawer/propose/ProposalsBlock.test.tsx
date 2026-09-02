/**
 * ProposalsBlock — the recorded-proposal history block on the Sollicitatie
 * tab. useProposals is stubbed so this file only tests ProposalsBlock's own
 * rendering rules: no empty frame, the revoked/opened/not-opened states, the
 * share-link actions (PROPOSE-SHARE-URL-1), and that revoke goes through the
 * house confirm path (never fires directly).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalsBlock from './ProposalsBlock'
import type { Proposal } from './useProposals'
import type { ApplicationDetail } from '@/types/application'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v }) }))

const mockUseProposals = vi.fn()
vi.mock('./useProposals', () => ({ useProposals: (id?: unknown) => mockUseProposals(id) }))

const app = { id: 1 } as ApplicationDetail

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  id: 'p1', recipient_name: 'Piet Klaassen', recipient_email: 'piet@zorggroep.nl',
  cv_variant: 'proposal', send_status: 'sent', send_error: null,
  sent_at: '2026-07-20', revoked_at: null, opened_at: null,
  open_count: 0, is_valid: true, share_url: null, share_expires_at: null, ...over,
})

const setProposals = (proposals: Proposal[], over: Partial<{ loading: boolean; error: boolean }> = {}) => {
  const revoke = vi.fn(() => Promise.resolve())
  mockUseProposals.mockReturnValue({ proposals, loading: false, error: false, revoke, revoking: false, ...over })
  return revoke
}

describe('ProposalsBlock', () => {
  it('renders nothing while loading', () => {
    setProposals([], { loading: true })
    const { container } = render(<ProposalsBlock application={app} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on error', () => {
    setProposals([], { error: true })
    const { container } = render(<ProposalsBlock application={app} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing without proposals (no empty frame)', () => {
    setProposals([])
    const { container } = render(<ProposalsBlock application={app} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the revoked state without a revoke button', () => {
    setProposals([proposal({ revoked_at: '2026-07-22' })])
    render(<ProposalsBlock application={app} />)
    expect(screen.getByText(/propose\.revoked:/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'propose.revoke' })).toBeNull()
  })

  it('shows the opened state with the open count when opened more than once', () => {
    setProposals([proposal({ opened_at: '2026-07-21', open_count: 3 })])
    render(<ProposalsBlock application={app} />)
    expect(screen.getByText(/propose\.openedOn:/)).toBeInTheDocument()
    expect(screen.getByText(/propose\.openCount:/)).toBeInTheDocument()
  })

  // PROPOSE-SHARE-URL-1 shipped: opened_at now genuinely reflects a customer
  // visit, so a live, unopened proposal shows "not opened yet" instead of an
  // absent slot (the old DEFECT-1 gate — "opened_at can never become non-null
  // so never claim not-opened either" — no longer holds; this replaces that
  // regression test with the new, real behaviour).
  it('shows the not-opened-yet state for a live proposal with no opened_at', () => {
    setProposals([proposal()])
    render(<ProposalsBlock application={app} />)
    expect(screen.getByText('propose.notOpenedYet')).toBeInTheDocument()
    expect(screen.queryByText(/propose\.openedOn/)).toBeNull()
  })

  it('asks for confirmation before calling revoke on a still-valid proposal', async () => {
    const revoke = setProposals([proposal()])
    render(<ProposalsBlock application={app} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'propose.revoke' }))
    // Not called yet — the confirm dialog must be accepted first (both the row's
    // trigger and the dialog's confirm button share the same label, so there are
    // now two matches; the confirm dialog's button is the last one added).
    expect(revoke).not.toHaveBeenCalled()
    const buttons = screen.getAllByRole('button', { name: 'propose.revoke' })
    await user.click(buttons[buttons.length - 1])
    expect(revoke).toHaveBeenCalledWith('p1')
  })

  // Core new behaviour: a sent, non-revoked proposal with a share_url shows a
  // copyable link action, and copying puts ONLY the raw URL on the clipboard —
  // never wrapped in extra text, never logged, never surfaced in the toast.
  it('shows a copy-link action for a live proposal and copies only the raw URL', async () => {
    const shareUrl = 'https://app.koiosmatch.test/p/proposal-abc123?signature=xyz'
    setProposals([proposal({ share_url: shareUrl, share_expires_at: '2026-08-10T00:00:00Z' })])
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    let toastMessage = ''
    const onToast = (e: Event) => { toastMessage = (e as CustomEvent).detail?.message ?? '' }
    window.addEventListener('km:toast', onToast)

    render(<ProposalsBlock application={app} />)
    // The raw URL is never rendered as visible text in the block.
    expect(screen.queryByText(shareUrl)).toBeNull()

    // userEvent.setup() installs its own real (in-memory) clipboard stub on
    // navigator.clipboard (jsdom itself ships none) — spy AFTER setup so the
    // spy wraps that stub instead of being overwritten by it.
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByRole('button', { name: 'propose.copyLink' }))

    expect(writeTextSpy).toHaveBeenCalledTimes(1)
    expect(writeTextSpy).toHaveBeenCalledWith(shareUrl)
    // The success toast is a static label, never the URL itself.
    expect(toastMessage).toBe('propose.linkCopied')
    expect(toastMessage).not.toContain(shareUrl)
    expect(logSpy).not.toHaveBeenCalled()

    window.removeEventListener('km:toast', onToast)
    logSpy.mockRestore()
  })

  // The open-in-new-tab action is a real, safe link — carries the exact
  // share_url as its href and the required rel attribute (no window.opener
  // handback to a third-party page).
  it('renders the open-link action as a safe new-tab anchor', () => {
    const shareUrl = 'https://app.koiosmatch.test/p/proposal-def456?signature=abc'
    setProposals([proposal({ share_url: shareUrl })])
    render(<ProposalsBlock application={app} />)
    const link = screen.getByRole('link', { name: 'propose.openLink' })
    expect(link).toHaveAttribute('href', shareUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // A revoked proposal never offers the link — asserted even when the mocked
  // data defensively still carries a share_url, proving the component itself
  // gates on !revoked_at rather than only trusting the field's presence.
  it('never offers the link for a revoked proposal, even if share_url is (defensively) still present', () => {
    setProposals([proposal({ revoked_at: '2026-07-22', is_valid: false, share_url: 'https://app.koiosmatch.test/p/should-not-show' })])
    render(<ProposalsBlock application={app} />)
    expect(screen.queryByRole('button', { name: 'propose.copyLink' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'propose.openLink' })).toBeNull()
  })

  // A read-only viewer (or any proposal the API did not attach a link to)
  // gets no link actions at all — the absence of share_url is honoured, not
  // worked around.
  it('offers no link actions when the backend did not attach a share_url', () => {
    setProposals([proposal({ share_url: null })])
    render(<ProposalsBlock application={app} />)
    expect(screen.queryByRole('button', { name: 'propose.copyLink' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'propose.openLink' })).toBeNull()
  })

  // K-248 PROPOSE-SEND-1: the delivery-truth chip renders the send_status label
  // and, on a failed send, the send_error as its tooltip (title attribute).
  it('shows the send-status chip with the send_error as a tooltip on failure', () => {
    setProposals([proposal({ send_status: 'failed', send_error: 'SMTP timeout' })])
    render(<ProposalsBlock application={app} />)
    const chip = screen.getByText('propose.sendStatus.failed')
    expect(chip.closest('[title]')).toHaveAttribute('title', 'SMTP timeout')
  })

  // A legacy row (send_status null) falls back to sent_at, mirroring the
  // backend resource's own fallback.
  it('falls back to a sent chip when send_status is null but sent_at is set', () => {
    setProposals([proposal({ send_status: null, sent_at: '2026-07-20' })])
    render(<ProposalsBlock application={app} />)
    expect(screen.getByText('propose.sendStatus.sent')).toBeInTheDocument()
  })

  // A never-sent legacy row (neither send_status nor sent_at) shows no chip.
  it('shows no send-status chip when neither send_status nor sent_at is set', () => {
    setProposals([proposal({ send_status: null, sent_at: null })])
    render(<ProposalsBlock application={app} />)
    expect(screen.queryByText(/propose\.sendStatus\./)).toBeNull()
  })
})
