/** AddOpportunityModal · lost-reason guard and stage refresh (split from AddOpportunityModal.test.tsx; the create and edit suites live in the sibling files). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddOpportunityModal from './AddOpportunityModal'
import api from '@/lib/api'
import { useOpportunityLostReasons } from '@/lib/useOpportunityLostReasons'
import type { Opportunity } from '@/types/opportunity'

vi.mock('@/lib/useOpportunityStages', async () => {
  const { STAGES } = await import('./AddOpportunityModal.testKit')
  // `stagesRef` lets a test hand the modal a NEW array reference (a lookup refresh).
  const stagesRef = { current: STAGES }
  return { useOpportunityStages: () => ({ stages: stagesRef.current }), __stagesRef: stagesRef, __STAGES: STAGES }
})
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
// ONIX D-003: a hoisted, mutable `me` so one test can narrow branch_ids without
// affecting the others (default stays unrestricted, same as before this change).
const authUser = vi.hoisted(() => ({ current: { id: 'me-1', name: 'Piet' } as { id: string; name: string; branch_ids?: Array<string | number> } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authUser.current }) }))
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
  // ONIX D-003: reset the branch-grants mock to unrestricted so a failed
  // assertion in one test can never leak grants into the next one.
  authUser.current = { id: 'me-1', name: 'Piet' }
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
