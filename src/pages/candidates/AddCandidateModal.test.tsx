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
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavigationProvider } from '@/context/NavigationContext'
import AddCandidateModal from './AddCandidateModal'
// CAND-IMPORT-FE-1: only the NETWORK calls are mocked — useImportWizard,
// EntityImportCard, PreviewStep and ResultStep all run for REAL, so the import
// tests below prove the actual wizard wiring (dry-run-before-real-run, close +
// refresh on success), not a stub of it (mirrors AddVacancyModal.test.tsx).
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

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

// Tenant lookups/auth/users/locations are network-backed hooks — mocked directly
// so the test isolates this modal's own wiring.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ phases: [
    // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant phase lookup colour (mirrors DEFAULT_PHASES)
    { value: 'lead', label: 'Lead', color: '#94A3B8', is_default: true },
    // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant phase lookup colour (mirrors DEFAULT_PHASES)
    { value: 'candidate', label: 'Kandidaat', color: '#79B58E' },
  ] }),
}))
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
  createCandidate.mockResolvedValue({ id: 'cand-new' })
  getMock.mockReset()
  // Default probe answer: nobody found (so the create-body tests stay unaffected).
  getMock.mockResolvedValue({ data: { exists: false, match: null } })
  postMock.mockReset()
  postMock.mockResolvedValue({ data: {} })
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
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
      street: null, house_number: null, house_number_suffix: null, postal_code: null,
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

// Job B (P1 follow-up, 2026-07-20): Mobiel sits paired next to Telefoon in the
// Contact card and rides along in the create body as its own `mobile` key.
describe('AddCandidateModal · Mobiel field (job B)', () => {
  it('renders a Mobiel field next to Telefoon in the Contact card', () => {
    render(<AddCandidateModal onClose={noop} />)
    // POP-UPS 1 (21-08): phone and mobile now share the one common:placeholders.phoneExample
    // key (they already rendered the same literal text before this consolidation) — assert
    // both fields exist via the two matches, rather than a per-field unique placeholder.
    expect(screen.getAllByPlaceholderText('common:placeholders.phoneExample')).toHaveLength(2)
  })

  it('POSTs the mobile value under its own `mobile` body key', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    // Phone renders before mobile in ContactCard's DOM order — index 1 is the mobile field.
    await user.type(screen.getAllByPlaceholderText('common:placeholders.phoneExample')[1], '0612345678')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    // DUP-PHONE-1 (08-08): still its own `mobile` key — but canonicalised at the save
    // boundary now, so the server's exact-match dedupe key cannot be dodged by writing
    // the same number differently. The notation matrix lives in its own describe below.
    expect(createCandidate.mock.calls[0][0]).toMatchObject({ mobile: '+31612345678' })
  })
})

// CONTACT-LINKEDIN-1 (Danny 06-08): the Contact card gets a LinkedIn field
// mirroring the customer contact modal and the drawer's own Contact tab.
describe('AddCandidateModal · LinkedIn field (CONTACT-LINKEDIN-1)', () => {
  it('renders a LinkedIn field in the Contact card', () => {
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByPlaceholderText('modal.fields.linkedinPlaceholder')).toBeInTheDocument()
  })

  it('normalises a pasted full profile URL to its bare slug AT THE SAVE BOUNDARY', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    await user.type(screen.getByPlaceholderText('modal.fields.linkedinPlaceholder'), 'https://www.linkedin.com/in/jane-doe/')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(createCandidate.mock.calls[0][0]).toMatchObject({ linkedin_slug: 'jane-doe' })
  })
})

// VALIDATIE-LIVE-1 (Danny 06-08): the ZZP-tab pattern becomes the standard — live,
// on-blur/typing format checks for email/phone/mobile/linkedin_slug, mirroring
// ProfileContactTab's own behaviour. A malformed value blocks the create instead
// of only bouncing back as a 422 after a round trip.
describe('AddCandidateModal · live format validation (VALIDATIE-LIVE-1)', () => {
  const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
  }

  it('shows an inline error under e-mail once blurred with a malformed value, and disables Create', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await fillRequired(user)
    const emailField = screen.getByPlaceholderText('common:placeholders.emailExample')
    await user.type(emailField, 'not-an-email')
    // fireEvent.focusOut (not user.tab()): this modal's dialog shell traps Tab via an
    // `offsetParent !== null` focusable-items check, which jsdom never sets (no real
    // layout) — it sees zero focusable items and swallows the Tab keydown, an
    // environment limitation of the shell, not of the field under test.
    fireEvent.focusOut(emailField)
    expect(await screen.findByText('validation.emailFormat')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
  })

  it('blocks the create call on a malformed phone number — value stays, nothing is sent', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await fillRequired(user)
    // Phone is the first of the two shared-placeholder matches (see ContactCard DOM order).
    const phoneInput = screen.getAllByPlaceholderText('common:placeholders.phoneExample')[0] as HTMLInputElement
    await user.type(phoneInput, '06-12')
    fireEvent.focusOut(phoneInput)
    expect(await screen.findByText('validation.phoneFormat')).toBeInTheDocument()
    expect(phoneInput.value).toBe('06-12')
    expect(createCandidate).not.toHaveBeenCalled()
  })

  it('a 422 field message renders under the field and the typed value is never wiped', async () => {
    createCandidate.mockRejectedValue({
      response: { status: 422, data: { errors: { email: ['Dit e-mailadres is al in gebruik.'] } } },
    })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await fillRequired(user)
    const emailInput = screen.getByPlaceholderText('common:placeholders.emailExample') as HTMLInputElement
    await user.type(emailInput, 'jan@example.nl')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(await screen.findByText('Dit e-mailadres is al in gebruik.')).toBeInTheDocument()
    // The typed value is untouched — nothing was cleared on the rejected save.
    expect(emailInput.value).toBe('jan@example.nl')
  })
})

// C-29 duplicate handling: the 409 used to dump the server's Dutch sentence into
// the error banner and throw the `existing` payload away. It must now render a
// translated panel with real actions built from that payload.
describe('AddCandidateModal · duplicate 409 panel', () => {
  // Mount inside the navigation provider so "open existing" can be asserted on the
  // REAL seam (the shell's goTo), not on a stubbed callback.
  const mountWithNav = (onClose = vi.fn()) => {
    const goTo = vi.fn()
    render(
      <NavigationProvider goTo={goTo}>
        <AddCandidateModal onClose={onClose} onCreated={noop} />
      </NavigationProvider>
    )
    return { goTo, onClose }
  }

  // Fill the two required fields and submit.
  const submit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
  }

  const reject409 = (existing: Record<string, unknown> | undefined) =>
    createCandidate.mockRejectedValue({
      response: { status: 409, data: { message: 'Kandidaat of lead bestaat al', existing } },
    })

  it('renders the translated panel with the duplicate name — never the raw server sentence', async () => {
    reject409({ id: 'dup-1', name: 'Anna Dubbel', type: 'available', archived: false })
    const user = userEvent.setup()
    mountWithNav()
    await submit(user)
    expect(await screen.findByText('duplicate.blockedTitle')).toBeInTheDocument()
    expect(screen.getByText('Anna Dubbel')).toBeInTheDocument()
    expect(screen.getByText('duplicate.stateActive')).toBeInTheDocument()
    // The regression that matters: the untranslated Dutch server message is gone.
    expect(screen.queryByText('Kandidaat of lead bestaat al')).not.toBeInTheDocument()
  })

  it('"open existing" navigates to that candidate and closes the create form', async () => {
    reject409({ id: 'dup-1', name: 'Anna Dubbel', archived: false })
    const user = userEvent.setup()
    const { goTo, onClose } = mountWithNav()
    await submit(user)
    await user.click(await screen.findByRole('button', { name: 'duplicate.open' }))
    expect(goTo).toHaveBeenCalledWith('candidates', { open: 'dup-1' })
    expect(onClose).toHaveBeenCalled()
  })

  it('an archived duplicate says so and restores via POST /candidates/{id}/restore', async () => {
    reject409({ id: 'dup-2', name: 'Bea Gearchiveerd', archived: true })
    const user = userEvent.setup()
    const { goTo } = mountWithNav()
    await submit(user)
    expect(await screen.findByText('duplicate.stateArchived')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'duplicate.restoreAndOpen' }))
    // Assert the REQUEST (method + route), then the follow-up navigation.
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/dup-2/restore'))
    await waitFor(() => expect(goTo).toHaveBeenCalledWith('candidates', { open: 'dup-2' }))
  })

  it('hides restore (but keeps open) without the candidates.update permission', async () => {
    state.permissions = []
    reject409({ id: 'dup-2', name: 'Bea Gearchiveerd', archived: true })
    const user = userEvent.setup()
    mountWithNav()
    await submit(user)
    expect(await screen.findByRole('button', { name: 'duplicate.open' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'duplicate.restoreAndOpen' })).not.toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('a 409 without an `existing` payload still shows our own translated line', async () => {
    reject409(undefined)
    const user = userEvent.setup()
    mountWithNav()
    await submit(user)
    expect(await screen.findByText('duplicate.blockedTitle')).toBeInTheDocument()
    expect(screen.queryByText('Kandidaat of lead bestaat al')).not.toBeInTheDocument()
  })
})

// DUP-PHONE-1 (Danny punt 4, 08-08): the backend duplicate guard compares the RAW
// column value, so '0612345678' and '+31612345678' were two different candidates to
// it — the same person, two dossiers. The create body must therefore carry ONE
// canonical spelling whichever way the recruiter types the number. Measured against
// the live API 2026-08-08: check-duplicate?mobile=0665277265 -> exists:false while
// ?mobile=%2B31665277265 -> exists:true for the very same candidate.
describe('AddCandidateModal · duplicate key is notation-independent', () => {
  // Fill the required names + the given mobile, submit, and hand back the POSTed body.
  const submitWithMobile = async (mobile: string): Promise<Record<string, unknown>> => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    // Mobile is the second of the two shared-placeholder matches (see ContactCard DOM order).
    await user.type(screen.getAllByPlaceholderText('common:placeholders.phoneExample')[1], mobile)
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    await waitFor(() => expect(createCandidate).toHaveBeenCalled())
    return createCandidate.mock.calls[0][0]
  }

  it.each(['+31612345678', '0612345678', '06-12345678', '06 12 34 56 78'])(
    'POSTs %s as the one canonical mobile the dedupe key compares on',
    async (typed) => {
      const body = await submitWithMobile(typed)
      expect(body.mobile).toBe('+31612345678')
    },
  )

  it('canonicalises the landline on the same save boundary', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    // Phone is the first of the two shared-placeholder matches (see ContactCard DOM order).
    await user.type(screen.getAllByPlaceholderText('common:placeholders.phoneExample')[0], '030-1234567')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    await waitFor(() => expect(createCandidate).toHaveBeenCalled())
    expect(createCandidate.mock.calls[0][0].phone).toBe('+31301234567')
  })

  it('never rewrites a value it cannot canonicalise safely', async () => {
    // No '+', no trunk '0' — inventing a country code here would corrupt the record.
    const body = await submitWithMobile('31612345678')
    expect(body.mobile).toBe('31612345678')
  })
})

// The recruiter-facing half of Danny punt 4: a hit must name the other dossier and
// keep every typed value, so the recruiter can look, decide, and save again.
describe('AddCandidateModal · duplicate on a differently written mobile', () => {
  it('names the existing candidate and leaves the form intact so saving stays possible', async () => {
    createCandidate.mockRejectedValue({
      response: { status: 409, data: { message: 'Kandidaat of lead bestaat al', existing: { id: 'dup-9', name: 'Lieke Blom', archived: false } } },
    })
    const user = userEvent.setup()
    render(
      <NavigationProvider goTo={vi.fn()}>
        <AddCandidateModal onClose={noop} onCreated={noop} />
      </NavigationProvider>
    )
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    // Mobile is the second of the two shared-placeholder matches (see ContactCard DOM order).
    const mobileInput = screen.getAllByPlaceholderText('common:placeholders.phoneExample')[1] as HTMLInputElement
    await user.type(mobileInput, '06-65277265')
    await user.click(screen.getByRole('button', { name: 'modal.create' }))

    // The request carried the canonical form — that is what let the server see the hit.
    await waitFor(() => expect(createCandidate.mock.calls[0][0].mobile).toBe('+31665277265'))
    // WHO it is (name only, §8) + a way to open that dossier.
    expect(await screen.findByText('Lieke Blom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'duplicate.open' })).toBeInTheDocument()
    // Nothing was cleared and the create button is still live: the recruiter decides.
    expect(mobileInput.value).toBe('06-65277265')
    const create = screen.getByRole('button', { name: 'modal.create' })
    expect(create).not.toBeDisabled()
    await user.click(create)
    await waitFor(() => expect(createCandidate).toHaveBeenCalledTimes(2))
  })
})

// PII-REGRESSIE: er stond hier een live probe die bij elke toetsaanslag het e-mailadres
// en mobiele nummer als QUERY-PARAMETER meestuurde. Een debounce verandert niets aan waar
// die gegevens landen: serverlogs, proxies, browsergeschiedenis (§7). De probe is
// verwijderd; deze test bewaakt dat hij niet terugkomt zolang de route een GET is.
describe('AddCandidateModal · geen PII in de URL', () => {
  it('vraagt nooit /candidates/check-duplicate op terwijl je typt', async () => {
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.emailExample'), 'piet@example.com')
    // Mobile is the second of the two shared-placeholder matches (see ContactCard DOM order).
    await user.type(screen.getAllByPlaceholderText('common:placeholders.phoneExample')[1], '0612345678')
    await new Promise(r => setTimeout(r, 900))
    const probed = getMock.mock.calls.some(([url]) => String(url).includes('check-duplicate'))
    expect(probed).toBe(false)
  })
})

// CAND-IMPORT-FE-1 (23-08): the Excel/CSV import affordance in the header —
// mirrors AddVacancyModal's own import describe block 1:1, pointed at the
// 'candidates' template (koiosmatch-api CandidateImporter).
describe('AddCandidateModal · Excel/CSV import in the header (CAND-IMPORT-FE-1)', () => {
  const csvFile = new File(['achternaam\nJansen'], 'kandidaten.csv', { type: 'text/csv' })
  // A dry run that would land one row — enough to unlock the real-import confirm.
  const cleanResult: ImportRunResult = {
    entity: 'candidates', dry_run: true,
    summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
    unknown_columns: [],
    rows: [{ row: 1, action: 'create', reference: 'Jansen', id: null, messages: [] }],
  }

  it('never renders the header import toggle without candidates.create — no fake affordance', () => {
    // state.permissions defaults to ['candidates.update'] in beforeEach.
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.queryByRole('button', { name: 'modal.import.title' })).not.toBeInTheDocument()
  })

  it('renders the header import toggle once candidates.create is granted, collapsed by default', () => {
    state.permissions = ['candidates.update', 'candidates.create']
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByRole('button', { name: 'modal.import.title' })).toHaveAttribute('aria-expanded', 'false')
    // No upload control until the toggle is opened.
    expect(screen.queryByLabelText('import.selectCsv')).not.toBeInTheDocument()
  })

  it('opening the toggle reveals the import card as the first card in the body', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    expect(screen.getByRole('button', { name: 'modal.import.title' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('modal.import.intro')).toBeInTheDocument()
    expect(screen.getByLabelText('import.selectCsv')).toBeInTheDocument()
  })

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    const input = screen.getByLabelText('import.selectCsv') as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('a dry run fires the REAL request against the candidate template, never the real import', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))

    // Before any file is picked, no confirm/real-import control exists at all.
    expect(screen.queryByRole('button', { name: 'import.preview.confirm' })).not.toBeInTheDocument()

    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))

    expect(dryRunImport).toHaveBeenCalledTimes(1)
    expect(dryRunImport).toHaveBeenCalledWith('candidates', expect.any(File))
    expect(runImport).not.toHaveBeenCalled()
    // ONLY once the dry run has resolved does the real-import control appear.
    expect(await screen.findByRole('button', { name: 'import.preview.confirm' })).toBeInTheDocument()
  })

  it('closes the modal and refreshes the list once a real import lands something', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    vi.mocked(runImport).mockResolvedValue({
      ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'c1' }],
    })
    const onClose = vi.fn()
    const onImported = vi.fn()
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={onClose} onImported={onImported} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))

    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))
    await user.click(await screen.findByRole('button', { name: 'import.preview.confirm' }))

    // The auto-close effect fires once the run RESULT lands something — never
    // leaving the untouched manual form open behind a candidate that now exists.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(runImport).toHaveBeenCalledWith('candidates', expect.any(File))
  })

  it('blocks the manual Create button while the import is past its upload step — never two creation paths armed at once', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))
    await screen.findByRole('button', { name: 'import.preview.confirm' })

    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
    expect(createCandidate).not.toHaveBeenCalled()
  })
})
