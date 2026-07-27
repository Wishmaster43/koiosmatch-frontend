/**
 * ProposeCandidateModal — covers the no-fake-affordance rule (no button whose
 * label suggests Koios actually sends anything), the honest "not sent yet" line,
 * and that the primary action is disabled without a contact / without the AVG
 * consent tick.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProposeCandidateModal from './ProposeCandidateModal'
import type { ApplicationDetail } from '@/types/application'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }) }))

vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
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
  },
}))
vi.mock('./useProposeForm', () => ({ useProposeForm: () => formFixture }))

const app = (over: Partial<ApplicationDetail> = {}): ApplicationDetail => ({
  id: 1, candidateId: 'c1', customerId: 'k1', candidateName: 'Jan de Vries', vacancyTitle: 'Verpleegkundige',
  client: 'Zorggroep Noord', bucket: 'active', archived: false, ...over,
} as unknown as ApplicationDetail)

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
