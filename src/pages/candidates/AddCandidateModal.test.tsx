/**
 * AddCandidateModal — covers Danny's Optie A layout rework (2026-07-18): the right
 * panel renders as titled cards (Persoonlijk / Contact / Werk) in the drill-down
 * style, the address card is always open (Danny r2), functietitel/geslacht/
 * provincie render as searchable comboboxen, Esc closes via the focus trap, and the submit body is UNCHANGED by the layout work — including the
 * explicit location_ids chips and the omit-when-empty rule (punt 10). Network-
 * backed hooks are mocked directly (no QueryClientProvider needed); the shared
 * form fields render for real. i18next is uninitialised in tests, so t() returns
 * raw keys — assertions query those keys (same pattern as MatchModal.test).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddCandidateModal from './AddCandidateModal'
// Hoisted mutable test state: per-test settings blob + permissions, plus the
// create spy the component's mocked mutation hook hands back.
const { state, createCandidate, getMock, postMock } = vi.hoisted(() => ({
  state: { settings: {} as Record<string, unknown>, permissions: ['candidates.update'] as string[] },
  // Typed with the body param so mock.calls[0][0] is a typed body in assertions.
  createCandidate: vi.fn<(body: Record<string, unknown>) => Promise<{ id: string }>>(async () => ({ id: 'cand-new' })),
  getMock: vi.fn(),
  postMock: vi.fn(),
}))
// The duplicate probe + restore talk to the real axios client — mock the seam so
// the tests can assert the REQUEST (route + params/body), not just a callback.
vi.mock('@/lib/api', () => ({ default: { get: getMock, post: postMock } }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// ONIX N-005: this modal's own RequiredCustomFieldsCard calls useCustomFields
// directly — mocked here (as every other create-modal test does, see
// AddApplicationModal.test.tsx) so it never reaches the above @/lib/api stub,
// which does not implement getActiveTenantId. No required def by default.
// B1: per-test required custom field defs for the host under test (empty by default).
const { customFieldsState } = vi.hoisted(() => ({ customFieldsState: { fields: [] as unknown[] } }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn() }) }))

// Tenant lookups/auth/users/locations are network-backed hooks — mocked directly
// so the test isolates this modal's own wiring.
vi.mock('@/context/LookupsContext', async () => {
  const { phases } = await import('./AddCandidateModal.testKit')
  return { useLookups: () => ({ phases }) }
})
// Keep the REAL getJsonSetting (the component parses the required-fields config
// through it); only the settings blob itself is test-controlled.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => state.settings }
})
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'u1', name: 'Piet Recruiter', branch_ids: ['b1'] },
  hasPermission: (p: string) => state.permissions.includes(p),
}) }))
vi.mock('./hooks/useCandidateMutations', () => ({ useCreateCandidate: () => ({ createCandidate, saving: false }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], functionOptions: [{ value: 'Verzorgende IG', label: 'Verzorgende IG' }], allowFreeEntry: true }) }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: [{ value: 'Utrecht', label: 'Utrecht' }] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'b1', label: 'Vestiging Noord' }, { value: 'b2', label: 'Vestiging Zuid' }] }))
// PROFILE-TEXT-1: Tiptap needs a real browser to mount — stubbed with a plain
// controlled textarea, mirrors the house convention (AddLocationModal.test.tsx /
// MatchModal.test.tsx). CollapsibleRichText itself runs for REAL, so the test
// below proves the actual collapsed-ghost -> reveal -> submit wiring.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

const noop = () => {}

beforeEach(() => {
  state.settings = {}
  state.permissions = ['candidates.update']
  createCandidate.mockReset()
  customFieldsState.fields = []
  createCandidate.mockResolvedValue({ id: 'cand-new' })
  getMock.mockReset()
  // Default probe answer: nobody found (so the create-body tests stay unaffected).
  getMock.mockResolvedValue({ data: { exists: false, match: null } })
  postMock.mockReset()
  postMock.mockResolvedValue({ data: {} })
})

describe('AddCandidateModal · Optie A card layout', () => {
  it('renders the titled cards (Persoonlijk / Contact / Werk) with their fields', () => {
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByText('modal.fields.cardPersonal')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardContact')).toBeInTheDocument()
    expect(screen.getByText('modal.fields.cardWork')).toBeInTheDocument()
    // A representative field per card still renders (names / email / function).
    expect(screen.getByPlaceholderText('common:placeholders.firstName')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('common:placeholders.emailExample')).toBeInTheDocument()
    // Trigger's name is the field label now, not its empty-state placeholder text.
    expect(screen.getByRole('button', { name: 'modal.fields.functionTitle' })).toBeInTheDocument()
    // Branch chips seed from /auth/me (punt 10) — the b1 chip is visible.
    expect(screen.getByText('Vestiging Noord')).toBeInTheDocument()
  })

  it('renders the address card open by default (Danny r2: geen inklap)', () => {
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByText('modal.fields.cardAddress')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('common:placeholders.streetExample')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('common:placeholders.cityExample')).toBeInTheDocument()
  })

  it('geslacht/provincie/functietitel are searchable comboboxen (drill-down pattern)', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    // Opening the function combobox reveals its type-to-filter input + lookup option.
    // Trigger's name is the field label now, not its empty-state placeholder text.
    await user.click(screen.getByRole('button', { name: 'modal.fields.functionTitle' }))
    expect(await screen.findByRole('button', { name: /Verzorgende IG/ })).toBeInTheDocument()
    // Province combobox lists the lookup value.
    await user.click(screen.getByRole('button', { name: 'modal.fields.province' }))
    expect(await screen.findByRole('button', { name: /Utrecht/ })).toBeInTheDocument()
  })

  it('Esc closes the modal via the focus trap', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  // CV-ENTRY-ICONS-1 (Danny 13-08): the two "from CV" banner cards are gone — a
  // header icon pair replaces them, and the card title only appears once a parse
  // has actually started (CvUploadCard/PasteCvCard return null while idle).
  it('shows CV entry as header icons, never the old banner cards, on open', () => {
    // Both parse routes require candidates.create — grant it for this assertion.
    state.permissions = ['candidates.update', 'candidates.create']
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByRole('button', { name: 'modal.cv.uploadButton' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.cvPaste.openButton' })).toBeInTheDocument()
    expect(screen.queryByText('modal.cv.title')).not.toBeInTheDocument()
    expect(screen.queryByText('modal.cvPaste.title')).not.toBeInTheDocument()
  })

  // Card-structure regression: every card renders its title, and every field
  // inside puts the label to the LEFT of the control (FieldRow/Field convention),
  // not stacked above it — the label text and its input share one row container.
  it('renders every card title with label-before-field rows', () => {
    render(<AddCandidateModal onClose={noop} />)
    ;['modal.fields.cardPersonal', 'modal.fields.cardContact', 'modal.fields.cardWork', 'modal.fields.cardAddress']
      .forEach(key => expect(screen.getByText(key)).toBeInTheDocument())

    const firstNameInput = screen.getByPlaceholderText('common:placeholders.firstName')
    const label = screen.getByText('modal.fields.firstName', { selector: 'label' })
    // Label and control share the same row wrapper (label's parent = the row div).
    expect(label.parentElement).toContainElement(firstNameInput)
    // The label node precedes the field node in DOM order (left in a row layout).
    expect(label.compareDocumentPosition(firstNameInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('AddCandidateModal · submit body unchanged by the layout rework', () => {
  it('POSTs the exact same body incl. the seeded location_ids', async () => {
    // NOTE: onCreated must be passed — `onCreated?.(await createCandidate(body))`
    // short-circuits the whole call (argument included) when the prop is absent.
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(createCandidate).toHaveBeenCalledWith({
      first_name: 'Jan', middle_name: null, last_name: 'Jansen', function_title: null,
      email: null, phone: null, mobile: null, date_of_birth: null, gender: null,
      street: null, house_number: null, house_number_suffix: null, address_line_2: null, postcode: null,
      city: null, province: null, country: null, owner_id: 'u1',
      // PROFILE-TEXT-1 (Danny 02-08): the profile-text card rides along on create;
      // untouched here, so it POSTs as null (never omitted, mirrors every other
      // optional field on this same body).
      summary: null,
      // CONTACT-LINKEDIN-1 (Danny 06-08): untouched here, so it POSTs as null too.
      linkedin_slug: null,
      phase: 'lead', status: 'available', candidate_types: [],
      location_ids: ['b1'],
    })
  })

  it('omits location_ids entirely when the branch chips are cleared (punt 10 omit-rule)', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    // Remove the single seeded chip, then submit with only the required names.
    await user.click(screen.getByRole('button', { name: 'common:remove' }))
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(createCandidate).toHaveBeenCalledTimes(1)
    expect(createCandidate.mock.calls[0][0]).not.toHaveProperty('location_ids')
  })
})

// PROFILE-TEXT-1 (Danny 02-08: "bij popup Nieuwe kandidaat ... moet altijd een
// tekstveld aanwezig zijn zoals we hebben bij + match"): the profile-text card
// (addmodal/ProfileTextCard) starts collapsed and its value rides along under
// `summary` in the create body once opened and filled in.
describe('AddCandidateModal · profile text card (PROFILE-TEXT-1)', () => {
  it('starts collapsed — no rich-text editor before the recruiter opens it', () => {
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    expect(screen.queryByLabelText('rich-text-editor')).toBeNull()
    expect(screen.getByRole('button', { name: 'common:add' })).toBeInTheDocument()
  })

  it('POSTs the typed prose under `summary`', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    // The collapsed ghost has no distinct aria-label here (no collision with this
    // modal's own submit button, unlike Location/Department's ARIA-LABEL-1 fix) —
    // its accessible name is the generic common:add placeholder text.
    await user.click(screen.getByRole('button', { name: 'common:add' }))
    fireEvent.change(screen.getByLabelText('rich-text-editor'), { target: { value: '<p>Ervaren verzorgende</p>' } })
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    expect(createCandidate).toHaveBeenCalledWith(expect.objectContaining({ summary: '<p>Ervaren verzorgende</p>' }))
  })
})
