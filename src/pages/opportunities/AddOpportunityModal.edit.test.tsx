/** AddOpportunityModal · edit mode (split from AddOpportunityModal.test.tsx; the create-mode suites stay there, the lost-reason guard and stage refresh live in AddOpportunityModal.lost.test.tsx). */
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
// test can control reasons/loading independently (mirrors useOpportunitiesData.test.tsx).
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
  // OPP-LOST-FE-1: no curated reasons by default — the lost-reason guard suite (AddOpportunityModal.lost.test.tsx)
  // overrides this per test when it needs the gate (or the loading race) to fire.
  mockedLostReasons.mockReturnValue({ reasons: [], loading: false, invalidate: vi.fn() })
  // ONIX D-003: reset the branch-grants mock to unrestricted so a failed
  // assertion in one test can never leak grants into the next one.
  authUser.current = { id: 'me-1', name: 'Piet' }
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

  // ONIX D-003: the Vestiging picker narrows to the user's own branch grants, but
  // a deal's EXISTING branch stays visible/selectable even outside those grants.
  it('ONIX D-003: narrows the branch picker to the user grants, keeping an out-of-scope existing branch visible', async () => {
    authUser.current = { id: 'me-1', name: 'Piet', branch_ids: ['branch-1'] }
    const user = userEvent.setup()
    const existingWithBranch = { ...existing, branchId: 'branch-2' } as unknown as Opportunity
    render(<AddOpportunityModal onClose={noop} existing={existingWithBranch} customers={[{ id: 'cust-1', name: 'Acme' }]} />)
    // The existing (out-of-grant) branch still shows and re-sends unchanged.
    expect(fieldTrigger('modal.fields.branch')).toHaveTextContent('Bijkantoor')
    await user.click(screen.getByRole('button', { name: 'modal.save' }))
    expect(api.patch).toHaveBeenCalledWith('/opportunities/opp-9', expect.objectContaining({ location_id: 'branch-2' }))
  })

  // ONIX D-003 verifier: HEAD (unrestricted) would also pass the test above since
  // withCurrentOption re-adds the existing out-of-grant branch to an otherwise-full
  // list. This create-mode case proves the actual NARROWING: no `existing` branch to
  // re-add, so a restricted grant must genuinely hide the other branch option.
  it('ONIX D-003: create mode narrows the branch picker options to the user\'s own grants', async () => {
    authUser.current = { id: 'me-1', name: 'Piet', branch_ids: ['branch-1'] }
    const user = userEvent.setup()
    render(<AddOpportunityModal onClose={noop} />)
    await user.click(fieldTrigger('modal.fields.branch'))
    expect(await screen.findByRole('button', { name: 'Hoofdkantoor' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bijkantoor' })).not.toBeInTheDocument()
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
