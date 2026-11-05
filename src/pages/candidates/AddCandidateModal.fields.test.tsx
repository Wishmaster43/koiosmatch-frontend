/** AddCandidateModal · mobile, LinkedIn and live format validation (split from AddCandidateModal.test.tsx; same mock header, own tests). */
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
// in AddCandidateModal.test.tsx proves the actual collapsed-ghost -> reveal -> submit wiring.
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

  // ONIX N-005: a 422 bag key no field renders (a required custom field) must not
  // fail silently — the banner picks it up alongside any mapped field errors.
  it('a 422 key no field renders (custom_fields.vog) lands in the submit banner', async () => {
    createCandidate.mockRejectedValue({
      response: { status: 422, data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } },
    })
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'modal.create' }))
    expect(await screen.findByText('common:validation.fieldRequiredNamed')).toBeInTheDocument()
  })
})
