/**
 * ProposalsBlock — the recorded-proposal history block on the Sollicitatie
 * tab. useProposals is stubbed so this file only tests ProposalsBlock's own
 * rendering rules: no empty frame, the revoked/opened/not-opened states, and
 * that revoke goes through the house confirm path (never fires directly).
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
  cv_variant: 'proposal', sent_at: '2026-07-20', revoked_at: null, opened_at: null,
  open_count: 0, is_valid: true, ...over,
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

  it('shows notOpenedYet when there is no open timestamp', () => {
    setProposals([proposal()])
    render(<ProposalsBlock application={app} />)
    expect(screen.getByText('propose.notOpenedYet')).toBeInTheDocument()
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
})
