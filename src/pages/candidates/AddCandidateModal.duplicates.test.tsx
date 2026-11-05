/** AddCandidateModal · duplicate 409 panel and duplicate keys (split from AddCandidateModal.test.tsx; same mock header, own tests). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavigationProvider } from '@/context/NavigationContext'
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
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/candidates/dup-2/restore', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
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
