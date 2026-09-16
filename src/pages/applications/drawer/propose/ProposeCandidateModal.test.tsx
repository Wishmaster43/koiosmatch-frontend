/**
 * ProposeCandidateModal — covers the no-fake-affordance rule (no button whose
 * label suggests Koios actually sends anything), the honest "not sent yet" line,
 * and that the primary action is disabled without a contact / without the AVG
 * consent tick.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import ProposeCandidateModal from './ProposeCandidateModal'
import type { ApplicationDetail } from '@/types/application'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }) }))

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, expanded, onToggleExpand }: { value?: string; onChange: (v: string) => void; expanded?: boolean; onToggleExpand?: () => void }) => (
    <div>
      <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
      {onToggleExpand && (
        <button type="button" data-testid="rte-expand-toggle" onClick={onToggleExpand}>{expanded ? 'collapse' : 'expand'}</button>
      )}
    </div>
  ),
}))

// Preflight decisions default to "no rule" (null, i.e. allow) — individual tests
// override via the hoisted mock's return value.
const { mockDecision } = vi.hoisted(() => ({ mockDecision: { candidate: null as unknown, customer: null as unknown } }))
vi.mock('@/components/actionrules', () => ({
  useActionRulePreflight: (action: string) => ({ decision: action.startsWith('candidate') ? mockDecision.candidate : mockDecision.customer }),
  ActionRuleBanner: ({ decision }: { decision: { message?: string } | null }) => (decision ? <div data-testid="banner">{decision.message}</div> : null),
  ActionRuleDialog: ({ open, decision }: { open: boolean; decision: { message?: string } | null }) =>
    open ? <div role="dialog" data-testid="block-dialog">{decision?.message}</div> : null,
}))

// The form hook has its own dedicated test (useProposeForm.test.ts) — here it is
// a controllable fixture so the modal's rendering/gating can be asserted in isolation.
const { formFixture } = vi.hoisted(() => ({
  formFixture: {
    contacts: [{ id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' }],
    contactsLoading: false, contactsError: false,
    candidateLoading: false, candidateError: false,
    recipientContactId: 'ct1', setRecipientContactId: vi.fn(),
    recipient: { id: 'ct1', name: 'Piet Klaassen', email: 'piet@zorggroep.nl' },
    cvVariant: 'proposal' as const, setCvVariant: vi.fn(),
    includeMotivation: false, setIncludeMotivation: vi.fn(), hasMotivation: false,
    subject: 'Voorstel Jan de Vries', setSubject: vi.fn(),
    body: '<p>Bericht</p>', setBody: vi.fn(),
    consentConfirmed: false, setConsentConfirmed: vi.fn(),
    disabledReason: 'noConsent' as const, submitting: false, submit: vi.fn(() => Promise.resolve(true)),
    copyMessage: vi.fn(), copied: false,
    shareUrl: null as string | null, copyShareLink: vi.fn(), shareLinkCopied: false,
    // VOORSTEL-AFZENDER-FE-1: sender picker state + the tenant users it lists.
    senderUserId: '', setSenderUserId: vi.fn(), users: [{ id: 'u2', name: 'Sara Demo' }],
    usersLoading: false,
  },
}))
vi.mock('./useProposeForm', () => ({ useProposeForm: () => formFixture }))

const app = (over: Partial<ApplicationDetail> = {}): ApplicationDetail => ({
  id: 1, candidateId: 'c1', customerId: 'k1', candidateName: 'Jan de Vries', vacancyTitle: 'Verpleegkundige',
  client: 'Zorggroep Noord', bucket: 'active', archived: false, ...over,
} as unknown as ApplicationDetail)

// Tests mutate the shared fixture in place; restore here so a throwing test can never leak state.
afterEach(() => { formFixture.senderUserId = ''; formFixture.usersLoading = false })

describe('ProposeCandidateModal', () => {
  it('never renders a button whose label suggests the message is actually sent', () => {
    mockDecision.candidate = null; mockDecision.customer = null
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    const buttonLabels = screen.getAllByRole('button').map(b => b.textContent?.toLowerCase() ?? '')
    expect(buttonLabels.some(l => l.includes('verzend') || l.includes('send'))).toBe(false)
  })

  it('shows the honest "not sent yet" line', () => {
    mockDecision.candidate = null; mockDecision.customer = null
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByText('propose.notSentYet')).toBeInTheDocument()
  })

  it('disables the primary action while the AVG consent tick is missing', () => {
    mockDecision.candidate = null; mockDecision.customer = null
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByText('propose.submit').closest('button')).toBeDisabled()
    expect(screen.getByText('propose.consentRequired')).toBeInTheDocument()
  })

  it('renders only the ActionRuleDialog (no propose form) when the preflight decision is a block', () => {
    mockDecision.candidate = { effect: 'block', message: 'Niet toegestaan' }; mockDecision.customer = null
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByTestId('block-dialog')).toBeInTheDocument()
    expect(screen.queryByText('propose.submit')).toBeNull()
  })

  it('shows a warning banner (not a block) inline when the decision is warn', () => {
    mockDecision.candidate = { effect: 'warn', message: 'Let op' }; mockDecision.customer = null
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByTestId('banner')).toHaveTextContent('Let op')
    expect(screen.getByText('propose.submit')).toBeInTheDocument()
  })
})

// V-appdetail-5: after a successful record, the share link is surfaced with a
// copy button — never a raw URL rendered as visible plain link text.
describe('ProposeCandidateModal · V-appdetail-5 share link on success', () => {
  it('renders no share-link affordance before a proposal has been recorded', () => {
    mockDecision.candidate = null; mockDecision.customer = null
    formFixture.shareUrl = null
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.queryByText('propose.copyLink')).toBeNull()
  })

  it('shows the copy-link button once the hook holds a share_url', () => {
    mockDecision.candidate = null; mockDecision.customer = null
    formFixture.shareUrl = 'https://app.example/p/abc123'
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByText('propose.recorded')).toBeInTheDocument()
    expect(screen.getByText('propose.copyLink')).toBeInTheDocument()
    // The raw URL itself is never rendered as visible text (§8).
    expect(screen.queryByText('https://app.example/p/abc123')).toBeNull()
  })

  it('clicking the copy button calls the hook\'s copyShareLink, not a re-implementation', async () => {
    mockDecision.candidate = null; mockDecision.customer = null
    formFixture.shareUrl = 'https://app.example/p/abc123'
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    await user.click(screen.getByText('propose.copyLink'))
    expect(formFixture.copyShareLink).toHaveBeenCalledTimes(1)
  })
})

// V-appdetail-4: the message body gets a real expand toggle (no pop-out — see
// this component's own docblock for the honest-skip reason).
describe('ProposeCandidateModal · V-appdetail-4 body expand', () => {
  it('toggles the body editor between expanded and collapsed', async () => {
    mockDecision.candidate = null; mockDecision.customer = null
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    const toggle = screen.getByTestId('rte-expand-toggle')
    expect(toggle).toHaveTextContent('expand')
    await user.click(toggle)
    expect(toggle).toHaveTextContent('collapse')
  })
})

// VOORSTEL-AFZENDER-FE-1: the sender section is a searchable, clearable picker (never a native select).
describe('ProposeCandidateModal · sender', () => {
  it('renders the sender section with a searchable picker defaulting to the proposer', async () => {
    const user = userEvent.setup()
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByText('propose.onBehalfOf')).toBeInTheDocument()
    expect(document.querySelector('select')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'propose.onBehalfOfSelf' }))
    await user.click(await screen.findByRole('button', { name: 'Sara Demo' }))
    expect(formFixture.setSenderUserId).toHaveBeenCalledWith('u2')
  })

  // VAC-CLEAR-1: an optional picker with a value set must be clearable, and the
  // clear must actually reach the underlying form state (never a no-op onChange).
  it('clears the picked sender back to the "self" placeholder', async () => {
    formFixture.senderUserId = 'u2'
    const user = userEvent.setup()
    const { rerender } = render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    // CreatableSelect names its clear cross t('clearField', { field: clearLabel }) —
    // clearLabel here is the mocked t's echo of t('propose.onBehalfOf').
    const clearName = 'clearField:{"field":"propose.onBehalfOf"}'
    await user.click(screen.getByRole('button', { name: clearName }))
    expect(formFixture.setSenderUserId).toHaveBeenCalledWith('')

    // The fixture doesn't wire setSenderUserId back into state itself — simulate
    // the commit and re-render to assert the trigger falls back to the placeholder.
    formFixture.senderUserId = ''
    rerender(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'propose.onBehalfOfSelf' })).toBeInTheDocument()
  })

  // An id that no longer matches any option (users still loading, or a stale
  // tenant default) must never leak the raw uuid into the trigger's text.
  it('shows the placeholder, not the raw uuid, for a sender id with no matching option', () => {
    formFixture.senderUserId = 'u-unknown'
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'propose.onBehalfOfSelf' })).toBeInTheDocument()
    expect(screen.queryByText('u-unknown')).toBeNull()
    formFixture.senderUserId = ''
  })
})

// D8: a failed contacts fetch must render an honest error state, never the
// "no contacts" empty-state copy (contactsError is a distinct flag from an
// actually-empty options list).
describe('ProposeCandidateModal · contacts fetch error', () => {
  afterEach(() => { formFixture.contactsError = false })

  it('shows the contactsError message, not the empty-state copy, when the contacts fetch fails', () => {
    formFixture.contactsError = true
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('propose.contactsError')
    expect(screen.queryByText('propose.noContacts')).toBeNull()
  })
})

// While the tenant users are still loading, a preselected default must not be shown as "self".
describe('ProposeCandidateModal · sender picker while users load', () => {
  it('shows the loading caption instead of the picker (never "self" for a preselected id)', () => {
    formFixture.senderUserId = 'u2'
    formFixture.usersLoading = true
    render(<ProposeCandidateModal application={app()} onClose={vi.fn()} />)
    expect(screen.getAllByText('propose.loading').length).toBeGreaterThan(0)
    expect(screen.queryByText('propose.onBehalfOfSelf')).toBeNull()
  })
})
