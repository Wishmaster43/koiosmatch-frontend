/**
 * CvProposalBlock / CvProposalCard — the review surface for a CV that arrived
 * with an application. useCvParseProposals is stubbed, so this file tests the
 * rendering rules that make accepting a decision instead of a reflex:
 * the current-vs-proposed comparison, the per-field outcome, the CV marking, the
 * confirm step, the honest read-only/error gating, and the hard rule that no
 * free-text value from the payload is ever rendered.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CvProposalBlock from './CvProposalBlock'
import { mapCvProposal } from '@/pages/applications/data/mapCvProposal'
import type { CvProposal } from '@/pages/applications/data/mapCvProposal'

// Deterministic key echo (repo precedent) — counts are appended so plural keys
// stay assertable without loading the real i18n singleton.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }),
}))
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})` }),
}))

const { notifyError, notifySuccess } = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notifyError, notifySuccess }))
vi.mock('@/lib/extractApiError', () => ({ extractApiError: (_e: unknown, fallback: string) => fallback }))

const mockHook = vi.fn()
vi.mock('./useCvParseProposals', () => ({ useCvParseProposals: (c?: unknown, a?: unknown) => mockHook(c, a) }))

const proposal = (overFields: Record<string, unknown> = {}, over: Partial<CvProposal> = {}): CvProposal => ({
  ...mapCvProposal({
    id: 'p1', application_id: 'a1', status: 'pending', model: 'claude-x',
    created_at: '2026-08-01T09:00:00+02:00',
    fields: {
      first_name: 'Sanne', last_name: 'de Groot', mobile: '0612345678',
      work_experiences: [], educations: [], ...overFields,
    },
  }),
  ...over,
})

// One place to shape the hook's return; returns the decide spy for assertions.
const setup = (over: Record<string, unknown> = {}) => {
  const decide = vi.fn(() => Promise.resolve())
  mockHook.mockReturnValue({
    proposals: [proposal()],
    loading: false, error: false,
    currentCandidate: { first_name: 'Sanne' },
    currentLoading: false, currentError: false,
    canDecide: true, decide, deciding: false, lastDecided: null,
    ...over,
  })
  return decide
}

const renderBlock = () => render(<CvProposalBlock candidateId="c1" applicationId="a1" />)

describe('CvProposalBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing without a linked candidate, and never asks the hook to fetch', () => {
    setup()
    const { container } = render(<CvProposalBlock candidateId={null} applicationId="a1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing while loading', () => {
    setup({ loading: true, proposals: [] })
    const { container } = renderBlock()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when this application has no proposal (no empty frame)', () => {
    setup({ proposals: [] })
    const { container } = renderBlock()
    expect(container).toBeEmptyDOMElement()
  })

  // Deliberately NOT silent: hiding a failed load would hide a pending,
  // unreviewed CV proposal — the one thing this block exists to surface.
  it('does render the error state', () => {
    setup({ error: true, proposals: [] })
    renderBlock()
    expect(screen.getByRole('alert')).toHaveTextContent('cvProposal.error')
  })

  it('shows the current value, the proposed value and the per-field outcome', () => {
    setup()
    renderBlock()

    // first_name is already on record → kept; last_name is blank → filled.
    expect(screen.getByRole('rowheader', { name: 'cvProposal.fields.first_name' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'cvProposal.fields.last_name' })).toBeInTheDocument()
    expect(screen.getByText('de Groot')).toBeInTheDocument()
    // Two blank fields (last_name, mobile) → two "will fill", one "will keep".
    expect(screen.getAllByText('cvProposal.willFill')).toHaveLength(2)
    expect(screen.getAllByText('cvProposal.willKeep')).toHaveLength(1)
    // Empty current values read as an honest placeholder, never a blank cell.
    expect(screen.getAllByText('cvProposal.currentEmpty').length).toBeGreaterThan(0)
  })

  it('marks every AI-read value as coming from the CV', () => {
    setup()
    renderBlock()
    // One badge per proposed scalar (3), so nothing reads as an established fact.
    expect(screen.getAllByText('cvProposal.badge')).toHaveLength(3)
    expect(screen.getByText('cvProposal.intro')).toBeInTheDocument()
    expect(screen.getByText('cvProposal.fillOnlyNotice')).toBeInTheDocument()
  })

  // THE safety assertion: a free-text field in the payload never reaches the DOM,
  // only a count of what was ignored.
  it('never renders a free-text field the payload carried', () => {
    setup({
      proposals: [proposal({ summary: 'Na mijn burn-out ben ik weer opgebouwd in de ouderenzorg.' })],
    })
    const { container } = renderBlock()

    expect(container.textContent).not.toContain('burn-out')
    expect(container.textContent).not.toContain('ouderenzorg')
    expect(screen.getByText(/cvProposal\.dropped:.*"count":1/)).toBeInTheDocument()
    expect(screen.getByText('cvProposal.noFreeText')).toBeInTheDocument()
  })

  it('lists the work experience and education rows the CV would append', () => {
    setup({
      proposals: [proposal({
        work_experiences: [{ company: 'Zorggroep Noord', position: 'Verzorgende IG', location: 'Zwolle', start_date: '2019', end_date: null }],
        educations: [{ degree: 'MBO Verzorgende IG', school: 'Deltion', issue_date: '2018' }],
      })],
    })
    renderBlock()

    expect(screen.getByText('Zorggroep Noord')).toBeInTheDocument()
    expect(screen.getByText('MBO Verzorgende IG')).toBeInTheDocument()
    // An open end date reads as "present", never as an empty period.
    expect(screen.getByText(/2019 – cvProposal.ongoing/)).toBeInTheDocument()
    expect(screen.getByText('cvProposal.appendNotice')).toBeInTheDocument()
  })

  it('requires a confirmation before accepting, then decides with accept', async () => {
    const decide = setup()
    renderBlock()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /cvProposal\.accept$/ }))
    expect(decide).not.toHaveBeenCalled()

    // The confirm dialog states the real outcome: 2 blank fields get filled.
    expect(screen.getByRole('dialog')).toHaveTextContent(/cvProposal\.acceptConfirm:.*"count":2/)
    const buttons = screen.getAllByRole('button', { name: /cvProposal\.accept$/ })
    await user.click(buttons[buttons.length - 1])

    expect(decide).toHaveBeenCalledWith('p1', 'accept')
  })

  it('requires a confirmation before rejecting, then decides with reject', async () => {
    const decide = setup()
    renderBlock()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'cvProposal.reject' }))
    expect(decide).not.toHaveBeenCalled()

    const buttons = screen.getAllByRole('button', { name: 'cvProposal.reject' })
    await user.click(buttons[buttons.length - 1])
    expect(decide).toHaveBeenCalledWith('p1', 'reject')
  })

  it('offers no decision buttons to a viewer without candidates.update', () => {
    setup({ canDecide: false })
    renderBlock()

    expect(screen.queryByRole('button', { name: /cvProposal\.accept$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'cvProposal.reject' })).toBeNull()
    expect(screen.getByText('cvProposal.readOnly')).toBeInTheDocument()
  })

  // Without the candidate's current values there is no comparison, so accepting
  // would be a blind write — the button is disabled rather than hidden, with the
  // reason next to it.
  it('disables accept when the current candidate data could not be loaded', () => {
    setup({ currentCandidate: null, currentError: true })
    renderBlock()

    expect(screen.getByRole('button', { name: /cvProposal\.accept$/ })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('cvProposal.currentError')
  })

  it('shows what actually landed after an accept', () => {
    const decided = { ...proposal(), status: 'accepted' as const, appliedFields: ['last_name', 'mobile'], skippedFields: ['first_name'] }
    setup({ proposals: [decided], lastDecided: decided })
    renderBlock()

    expect(screen.getByText('cvProposal.status.accepted')).toBeInTheDocument()
    expect(screen.getByText(/cvProposal\.resultApplied:.*"count":2/)).toBeInTheDocument()
    expect(screen.getByText(/cvProposal\.resultSkipped:.*"count":1/)).toBeInTheDocument()
    // A decided proposal offers no decision buttons any more.
    expect(screen.queryByRole('button', { name: /cvProposal\.accept$/ })).toBeNull()
  })

  it('reports a failed decision instead of claiming success', async () => {
    const decide = vi.fn(() => Promise.reject(new Error('boom')))
    setup({ decide })
    renderBlock()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /cvProposal\.accept$/ }))
    const buttons = screen.getAllByRole('button', { name: /cvProposal\.accept$/ })
    await user.click(buttons[buttons.length - 1])

    expect(notifyError).toHaveBeenCalledWith('common:actionFailed')
    expect(notifySuccess).not.toHaveBeenCalled()
  })
})
