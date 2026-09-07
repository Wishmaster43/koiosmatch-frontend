/**
 * AddOpportunityModal · house wide frame (Danny 27-07: "Loop gelijk het scherm
 * na, de popup!!") — the popup moves onto WIDE_MODAL with two titled cards and
 * every dropdown becomes the searchable CreatableSelect (never a bare
 * <select>). Behaviour must stay identical: same POST/PATCH payload, same
 * validation, same 422 mapping, same onCreated/onClose callbacks. The tenant
 * lookup + cascade hooks are a different file's scope — mocked directly (no
 * QueryClientProvider needed), mirroring MatchModal.test.tsx.
 *
 * Danny's screenshot round (08-08): K1 covers the panel now sharing MatchModal's
 * exact `width="94vw"` footprint; K2 covers the new Vestiging (branch) picker —
 * `location_id`, distinct from the existing customer→location cascade.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddOpportunityModal from './AddOpportunityModal'
import api from '@/lib/api'
import { useOpportunityLostReasons } from '@/lib/useOpportunityLostReasons'
import type { Opportunity } from '@/types/opportunity'

/* eslint-disable no-restricted-syntax -- fixture DATA mirroring the seed stage colours, not UI styling */
vi.mock('@/lib/useOpportunityStages', () => {
  // A STABLE array reference (built once, at module-eval time) — the modal's own
  // stageId-resolve effect depends on `[stages]`; a fresh array literal on every
  // call (the old inline shape) re-fires that effect on every render and silently
  // resets a manually-picked stage back to `existing.stageValue` (mirrors the real
  // hook's memoized `stages`, which is stable across renders in production).
  const STAGES = [
    { id: 'stage-1', value: 'lead', label: 'Lead', color: '#94A3B8' },
    { id: 'stage-2', value: 'won', label: 'Gewonnen', color: '#79B58E' },
    // OPP-LOST-FE-1: the one is_lost stage the guard tests below target — colour
    // mirrors DEFAULT_OPPORTUNITY_STAGES's own 'lost' seed entry.
    { id: 'stage-3', value: 'lost', label: 'Verloren', color: '#D98A8A', isLost: true },
  ]
  // `stagesRef` lets a test hand the modal a NEW array reference (a lookup refresh).
  const stagesRef = { current: STAGES }
  return { useOpportunityStages: () => ({ stages: stagesRef.current }), __stagesRef: stagesRef, __STAGES: STAGES }
})
/* eslint-enable no-restricted-syntax */
vi.mock('@/lib/useOpportunityLookups', () => ({
  useOpportunityServiceTypes: () => ({ serviceTypes: [{ id: 'svc-1', value: 'zorg', label: 'Zorg' }] }),
  useOpportunityAgreementTypes: () => ({ agreementTypes: [{ id: 'agr-1', value: 'framework', label: 'Mantelovereenkomst' }] }),
}))
// OPP-LOST-FE-1: the tenant's curated lost reasons — a plain vi.fn() so each guard
// test below can control reasons/loading independently (mirrors useOpportunitiesData.test.tsx).
vi.mock('@/lib/useOpportunityLostReasons', () => ({ useOpportunityLostReasons: vi.fn() }))
// The customer→location→department→contact cascade (a different file's scope,
// network-backed) — a minimal fixture, mirrors MatchModal.test.tsx.
vi.mock('./hooks/useCustomerCascade', () => ({
  useCustomerCascade: () => ({
    locations: [{ id: 'loc-1', name: 'Locatie Noord', departments: [{ id: 'dep-1', name: 'Afdeling A' }] }],
    // 'con-2' shares a name with a real duplicate (Danny 28-07 screenshot: same
    // contact coupled to several locations/departments) but carries a function —
    // the option label must disambiguate it, the submitted id must stay the id.
    contacts: [{ id: 'con-1', name: 'Jan Jansen' }, { id: 'con-2', name: 'Eva Bos', function: 'HR Manager' }],
  }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me-1', name: 'Piet' } }) }))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors the house convention (AddLocationModal.test.tsx / DescriptionTab.test.tsx).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
// K2: the shared branch (Vestiging) lookup — mirrors MatchModal.test.tsx's own
// '@/lib/useLocations' mock, no QueryClientProvider needed.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Hoofdkantoor' }, { value: 'branch-2', label: 'Bijkantoor' }],
}))
// Real `unwrap` (importActual) so the POST/PATCH response parsing stays exactly
// production; only the HTTP methods themselves are spied on.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return {
    ...actual,
    default: {
      // The Koios Wizard/Auto switch reads the user's own mode on mount.
      get: vi.fn(() => Promise.resolve({ data: { data: {} } })),
      post: vi.fn(() => Promise.resolve({ data: { data: { id: 'opp-1' } } })),
      patch: vi.fn(() => Promise.resolve({ data: { data: { id: 'opp-9' } } })),
    },
  }
})

const noop = () => {}
// Scope a CreatableSelect trigger by its Field label (the house pattern for
// pickers that share a generic placeholder like 'common:select' — mirrors
// MatchModal.test.tsx's branchField/ownerField helpers).
// CLEAR-SWEEP (Danny 13-08): once a field carries a value its clearable cross
// renders too — the trigger is always the FIRST button (DOM order), the clear
// cross (when present) the second, so this picks index 0 explicitly.
const fieldTrigger = (label: string) => within(screen.getByText(label).parentElement as HTMLElement).getAllByRole('button')[0]
const mockedLostReasons = vi.mocked(useOpportunityLostReasons)

beforeEach(() => {
  vi.clearAllMocks()
  // OPP-LOST-FE-1: no curated reasons by default — the guard describe block below
  // overrides this per test when it needs the gate (or the loading race) to fire.
  mockedLostReasons.mockReturnValue({ reasons: [], loading: false, invalidate: vi.fn() })
})

describe('AddOpportunityModal · house wide frame (Danny 27-07)', () => {
  it('renders on the shared WIDE_MODAL frame with the two titled cards', () => {
    render(<AddOpportunityModal onClose={noop} />)
    // POPUP-SLEEP-1: FloatingPanel owns the footprint — WIDE_MODAL width, panel's 92vh cap.
    expect(screen.getByRole('dialog')).toHaveStyle({ maxWidth: '1320px', maxHeight: '92vh' })
    expect(screen.getByText('modal.groups.general')).toBeInTheDocument()
    expect(screen.getByText('modal.groups.dealStage')).toBeInTheDocument()
  })

  it('K1: shares MatchModal\'s exact width prop (94vw), not the old near-equivalent calc()', () => {
    render(<AddOpportunityModal onClose={noop} />)
    // Mirrors MatchModal.test.tsx's own footprint assertion style (dialog inline style).
    expect(screen.getByRole('dialog')).toHaveStyle({ width: '94vw' })
  })

  it('has no bare <select> element left — every dropdown is the searchable CreatableSelect', () => {
    const { container } = render(
      <AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]} users={[{ id: 'u1', name: 'Piet' }]} />,
    )
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })

  it('closes on Escape (house focus-trap — this modal lacked one before)', async () => {
    const onClose = vi.fn()
    render(<AddOpportunityModal onClose={onClose} />)
    await userEvent.setup().keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('AddOpportunityModal · validation unchanged (title required)', () => {
  it('disables the submit button while the title is empty', () => {
    render(<AddOpportunityModal onClose={noop} />)
    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
  })

  it('enables the submit button once a title is typed', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), '5 verpleegkundigen')
    expect(screen.getByRole('button', { name: 'modal.create' })).toBeEnabled()
  })
})

describe('AddOpportunityModal · same POST payload as before, searchable picks included', () => {
  it('posts the same body shape, with the searchable customer/stage picks riding it', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    render(
      <AddOpportunityModal onClose={noop} onCreated={onCreated}
        customers={[{ id: 'cust-1', name: 'Acme' }]} users={[{ id: 'u1', name: 'Piet' }]} />,
    )
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), '5 verpleegkundigen')

    await user.click(fieldTrigger('modal.fields.client'))
    await user.click(await screen.findByRole('button', { name: 'Acme' }))

    await user.click(fieldTrigger('modal.fields.stage'))
    await user.click(await screen.findByRole('button', { name: 'Lead' }))

    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    expect(api.post).toHaveBeenCalledWith('/opportunities', expect.objectContaining({
      title: '5 verpleegkundigen',
      customer_id: 'cust-1',
      opportunity_stage_id: 'stage-1',
      service_type_id: null,
      agreement_type_id: null,
      value: null,
      hours: null,
      customer_location_id: null,
      department_id: null,
      contact_id: null,
    }))
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  // CLEAR-SWEEP (Danny 13-08): the customer picker is genuinely optional (body
  // sends `customer_id: form.clientId || null`) — a pick must be releasable.
  it('CLEAR-SWEEP: clears a picked customer back to the placeholder', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    await user.click(fieldTrigger('modal.fields.client'))
    await user.click(await screen.findByRole('button', { name: 'Acme' }))
    expect(fieldTrigger('modal.fields.client')).toHaveTextContent('Acme')

    const clear = within(screen.getByText('modal.fields.client').parentElement as HTMLElement).getByTitle(/clearField/i)
    await user.click(clear)
    expect(fieldTrigger('modal.fields.client')).toHaveTextContent('common:select')
  })

  it('the location/department/contact cascade rides the body once picked', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans met locatie')
    await user.click(fieldTrigger('modal.fields.client'))
    await user.click(await screen.findByRole('button', { name: 'Acme' }))

    await user.click(fieldTrigger('modal.fields.location'))
    await user.click(await screen.findByRole('button', { name: 'Locatie Noord' }))
    await user.click(fieldTrigger('modal.fields.department'))
    await user.click(await screen.findByRole('button', { name: 'Afdeling A' }))
    await user.click(fieldTrigger('modal.fields.contact'))
    await user.click(await screen.findByRole('button', { name: 'Jan Jansen' }))

    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(api.post).toHaveBeenCalledWith('/opportunities', expect.objectContaining({
      customer_location_id: 'loc-1', department_id: 'dep-1', contact_id: 'con-1',
    }))
  })

  it('K2: sends location_id null when the Vestiging branch picker is left untouched', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans zonder vestiging')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(api.post).toHaveBeenCalledWith('/opportunities', expect.objectContaining({ location_id: null }))
  })

  it('K2: the Vestiging branch pick rides the body as location_id — distinct from customer_location_id', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans met vestiging')

    await user.click(fieldTrigger('modal.fields.branch'))
    await user.click(await screen.findByRole('button', { name: 'Hoofdkantoor' }))

    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(api.post).toHaveBeenCalledWith('/opportunities', expect.objectContaining({
      location_id: 'branch-1', customer_location_id: null,
    }))
  })

  it('contact picker (28-07): the option label carries the function title, but the id submitted stays plain', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans met contact')
    await user.click(fieldTrigger('modal.fields.client'))
    await user.click(await screen.findByRole('button', { name: 'Acme' }))

    await user.click(fieldTrigger('modal.fields.contact'))
    // The disambiguated label is what renders — a bare "Eva Bos" button must not exist.
    expect(screen.queryByRole('button', { name: 'Eva Bos' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Eva Bos — HR Manager' }))

    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    // The REQUEST carries the plain contact id — the function title is cosmetic only.
    expect(api.post).toHaveBeenCalledWith('/opportunities', expect.objectContaining({ contact_id: 'con-2' }))
  })
})

describe('AddOpportunityModal · Kanstekst (OPP-DESCRIPTION-1)', () => {
  it('omits description from the POST body entirely when the collapsed card is never opened', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans zonder tekst')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    expect(api.post).toHaveBeenCalledTimes(1)
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect('description' in body).toBe(false)
  })

  it('rides the typed Kanstekst on the POST body once the card is opened and filled', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans met tekst')

    // The card starts as a collapsed ghost (CollapsibleRichText) — never auto-open.
    await user.click(screen.getByRole('button', { name: 'modal.groups.description' }))
    await user.type(screen.getByLabelText('rich-text-editor'), 'Belangrijke context over deze kans')

    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(api.post).toHaveBeenCalledWith('/opportunities', expect.objectContaining({
      description: 'Belangrijke context over deze kans',
    }))
  })

  it('omits description when the card is opened but left blank/whitespace-only', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans met lege tekst')

    await user.click(screen.getByRole('button', { name: 'modal.groups.description' }))
    await user.type(screen.getByLabelText('rich-text-editor'), '   ')

    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    const body = vi.mocked(api.post).mock.calls[0][1] as Record<string, unknown>
    expect('description' in body).toBe(false)
  })
})

describe('AddOpportunityModal · OPP-MODAL-PREFILL-1 (initialLocationId/initialDepartmentId/initialContactId)', () => {
  it('shows the location/department/contact pickers pre-selected on mount, from the initial* props', () => {
    render(
      <AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]}
        defaultCustomerId="cust-1" initialLocationId="loc-1" initialDepartmentId="dep-1" initialContactId="con-1" />,
    )
    // Options resolve straight from the mocked cascade (no network round trip in
    // the test), so the pre-selected labels are visible on the very first render.
    expect(fieldTrigger('modal.fields.location')).toHaveTextContent('Locatie Noord')
    expect(fieldTrigger('modal.fields.department')).toHaveTextContent('Afdeling A')
    expect(fieldTrigger('modal.fields.contact')).toHaveTextContent('Jan Jansen')
  })

  it('posts the pre-selected cascade ids unchanged when the recruiter submits without touching them', async () => {
    const user = userEvent.setup()
    render(
      <AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]}
        defaultCustomerId="cust-1" initialLocationId="loc-1" initialDepartmentId="dep-1" initialContactId="con-1" />,
    )
    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Kans vanuit locatie-tab')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(api.post).toHaveBeenCalledWith('/opportunities', expect.objectContaining({
      customer_id: 'cust-1', customer_location_id: 'loc-1', department_id: 'dep-1', contact_id: 'con-1',
    }))
  })

  it('only pre-selects the ONE level actually passed — the others stay unset (mirrors the scoped-tab caller)', () => {
    render(
      <AddOpportunityModal onClose={noop} customers={[{ id: 'cust-1', name: 'Acme' }]}
        defaultCustomerId="cust-1" initialContactId="con-1" />,
    )
    expect(fieldTrigger('modal.fields.contact')).toHaveTextContent('Jan Jansen')
    expect(fieldTrigger('modal.fields.location')).not.toHaveTextContent('Locatie Noord')
  })
})

describe('AddOpportunityModal · card-structure regression (MODAL-CANON: FieldRow label-left, mirrors AddCustomerModal/MatchModal)', () => {
  it('renders both titled cards, each field as a label-LEFT row (a <label> before its field)', () => {
    render(<AddOpportunityModal onClose={noop} />)
    expect(screen.getByText('modal.groups.general')).toBeInTheDocument()
    expect(screen.getByText('modal.groups.dealStage')).toBeInTheDocument()

    // FieldRow renders <label>{text}</label> as the FIRST child of the row, the
    // field itself as a sibling — proves the swap from the old label-above `Field`
    // landed, not just a visual coincidence.
    const titleLabel = screen.getByText('modal.fields.title')
    expect(titleLabel.tagName).toBe('LABEL')
    const row = titleLabel.parentElement as HTMLElement
    expect(row.children[0]).toBe(titleLabel)
    expect(row.children).toHaveLength(2)
  })
})

describe('AddOpportunityModal · edit mode (existing prop) — PATCH, never POST', () => {
  const existing = {
    id: 'opp-9', title: 'Bestaande kans', clientId: 'cust-1', stageValue: 'lead',
    value: null, hours: null, startDate: null, endDate: null, expectedCloseAt: null,
    ownerId: null, serviceTypeId: null, agreementTypeId: null,
    locationId: null, departmentId: null, contactId: null,
  } as unknown as Opportunity

  it('submits a PATCH to /opportunities/{id}, never a POST', async () => {
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    await user.click(screen.getByRole('button', { name: 'modal.save' }))
    expect(api.patch).toHaveBeenCalledWith('/opportunities/opp-9', expect.objectContaining({ title: 'Bestaande kans' }))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('K2: prefills the Vestiging branch picker from existing.branchId and re-sends it unchanged on save', async () => {
    const user = userEvent.setup()
    const existingWithBranch = { ...existing, branchId: 'branch-2' } as unknown as Opportunity
    render(<AddOpportunityModal onClose={noop} existing={existingWithBranch} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    expect(fieldTrigger('modal.fields.branch')).toHaveTextContent('Bijkantoor')
    await user.click(screen.getByRole('button', { name: 'modal.save' }))
    expect(api.patch).toHaveBeenCalledWith('/opportunities/opp-9', expect.objectContaining({ location_id: 'branch-2' }))
  })

  it('OPP-DESCRIPTION-1: prefills the Kanstekst collapsed preview from existing.description and re-sends it unchanged', async () => {
    const user = userEvent.setup()
    const existingWithDescription = { ...existing, description: '<p>Bestaande kanstekst</p>' } as unknown as Opportunity
    render(<AddOpportunityModal onClose={noop} existing={existingWithDescription} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    // Collapsed-ghost preview strips tags — the stored HTML shows as plain text.
    expect(screen.getByRole('button', { name: 'modal.groups.description' })).toHaveTextContent('Bestaande kanstekst')

    await user.click(screen.getByRole('button', { name: 'modal.save' }))
    expect(api.patch).toHaveBeenCalledWith('/opportunities/opp-9', expect.objectContaining({
      description: '<p>Bestaande kanstekst</p>',
    }))
  })
})

// OPP-LOST-FE-1: the edit-mode 'Waarde & fase' Fase picker is a THIRD path that can
// move an opportunity onto an is_lost stage (board drag + drawer picker were already
// gated in useOpportunitiesData — this modal's own save was not). Reuses the exact
// shared modal/hook, gated by the extracted lostReasonGuard.needsLostReason helper.
describe('AddOpportunityModal · OPP-LOST-FE-1 lost-reason guard on save', () => {
  const existing = {
    id: 'opp-9', title: 'Bestaande kans', clientId: 'cust-1', stageValue: 'lead',
    value: null, hours: null, startDate: null, endDate: null, expectedCloseAt: null,
    ownerId: null, serviceTypeId: null, agreementTypeId: null,
    locationId: null, departmentId: null, contactId: null,
  } as unknown as Opportunity

  it('picking a lost stage with reasons configured opens the confirm modal; confirm stays disabled until a reason is picked, then PATCHes stage + lost_reason + lost_reason_key', async () => {
    const user = userEvent.setup()
    mockedLostReasons.mockReturnValue({ reasons: [{ value: 'Budget', label: 'Budget', color: undefined, key: 'budget_cut' }], loading: false, invalidate: vi.fn() })
    render(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)

    await user.click(fieldTrigger('modal.fields.stage'))
    await user.click(await screen.findByRole('button', { name: 'Verloren' }))

    // The save itself must NOT PATCH yet — it opens the shared confirm first.
    await user.click(screen.getByRole('button', { name: 'modal.save' }))
    expect(api.patch).not.toHaveBeenCalled()

    const confirmBtn = await screen.findByRole('button', { name: 'lost.confirm' })
    expect(confirmBtn).toBeDisabled()

    await user.click(await screen.findByRole('button', { name: 'lost.reasonPlaceholder' }))
    await user.click(await screen.findByRole('button', { name: 'Budget' }))
    expect(confirmBtn).toBeEnabled()

    await user.click(confirmBtn)
    expect(api.patch).toHaveBeenCalledWith('/opportunities/opp-9', expect.objectContaining({
      opportunity_stage_id: 'stage-3', lost_reason: 'Budget', lost_reason_key: 'budget_cut',
    }))
  })

  it('cancel: no PATCH fires, the confirm closes back onto the untouched form', async () => {
    const user = userEvent.setup()
    mockedLostReasons.mockReturnValue({ reasons: [{ value: 'Budget', label: 'Budget' }], loading: false, invalidate: vi.fn() })
    render(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)

    await user.click(fieldTrigger('modal.fields.stage'))
    await user.click(await screen.findByRole('button', { name: 'Verloren' }))
    await user.click(screen.getByRole('button', { name: 'modal.save' }))

    await user.click(await screen.findByRole('button', { name: 'common:cancel' }))
    expect(api.patch).not.toHaveBeenCalled()
    // The confirm popup itself is gone — the form stays open, stage pick untouched.
    expect(screen.queryByRole('button', { name: 'lost.confirm' })).not.toBeInTheDocument()
    expect(fieldTrigger('modal.fields.stage')).toHaveTextContent('Verloren')
  })

  it('no reasons configured: saving a lost stage PATCHes directly, without lost_reason (empty list = no gate, per the lookup\'s own contract)', async () => {
    const user = userEvent.setup()
    mockedLostReasons.mockReturnValue({ reasons: [], loading: false, invalidate: vi.fn() })
    render(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)

    await user.click(fieldTrigger('modal.fields.stage'))
    await user.click(await screen.findByRole('button', { name: 'Verloren' }))
    await user.click(screen.getByRole('button', { name: 'modal.save' }))

    expect(api.patch).toHaveBeenCalledWith('/opportunities/opp-9', expect.objectContaining({ opportunity_stage_id: 'stage-3' }))
    const body = vi.mocked(api.patch).mock.calls[0][1] as Record<string, unknown>
    expect('lost_reason' in body).toBe(false)
  })

  it('LOADING RACE: while the reasons lookup is still loading, save stays disabled and no PATCH fires — once it resolves, save proceeds', async () => {
    const user = userEvent.setup()
    mockedLostReasons.mockReturnValue({ reasons: [], loading: true, invalidate: vi.fn() })
    const { rerender } = render(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)

    await user.click(fieldTrigger('modal.fields.stage'))
    await user.click(await screen.findByRole('button', { name: 'Verloren' }))

    const saveBtn = screen.getByRole('button', { name: 'modal.save' })
    expect(saveBtn).toBeDisabled()
    await user.click(saveBtn)
    expect(api.patch).not.toHaveBeenCalled()

    // The lookup resolves with no curated reasons — a re-render picks up the new value.
    mockedLostReasons.mockReturnValue({ reasons: [], loading: false, invalidate: vi.fn() })
    rerender(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)

    expect(screen.getByRole('button', { name: 'modal.save' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'modal.save' }))
    expect(api.patch).toHaveBeenCalledWith('/opportunities/opp-9', expect.objectContaining({ opportunity_stage_id: 'stage-3' }))
  })
})

// Review 03-09: `stages` changes reference when the lookup lands or the language switches;
// the edit-mode stage resolver must not overwrite a stage the user picked meanwhile.
describe('AddOpportunityModal · a stages refresh never overwrites a manual stage pick', () => {
  const existing = {
    id: 'opp-9', title: 'Bestaande kans', clientId: 'cust-1', stageValue: 'lead',
    value: null, hours: null, startDate: null, endDate: null, expectedCloseAt: null,
    ownerId: null, serviceTypeId: null, agreementTypeId: null,
    locationId: null, departmentId: null, contactId: null,
  } as unknown as Opportunity

  it('keeps the picked stage after the stages array changes reference', async () => {
    const user = userEvent.setup()
    const mod = await import('@/lib/useOpportunityStages') as unknown as { __stagesRef: { current: unknown[] }; __STAGES: unknown[] }
    const { rerender } = render(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    expect(fieldTrigger('modal.fields.stage')).toHaveTextContent('Lead')
    await user.click(fieldTrigger('modal.fields.stage'))
    await user.click(await screen.findByRole('button', { name: 'Gewonnen' }))
    expect(fieldTrigger('modal.fields.stage')).toHaveTextContent('Gewonnen')
    // The lookup lands again (new array reference): the manual pick must survive.
    mod.__stagesRef.current = [...mod.__STAGES]
    rerender(<AddOpportunityModal onClose={noop} existing={existing} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    expect(fieldTrigger('modal.fields.stage')).toHaveTextContent('Gewonnen')
    mod.__stagesRef.current = mod.__STAGES
  })
})
