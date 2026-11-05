/** AddCustomerModal · duplicate probe and 409 panel (split from AddCustomerModal.test.tsx; resolves copy through the active locale's own i18n). */
/**
 * AddCustomerModal — covers the house "wide form" adoption (Danny 27-07: "+
 * Klant is niet zo groot als + match en + nieuwe kandidaat EN MIST HEEL VEEL
 * INFORMATIE") and the 02-08 alignment with AddCandidateModal: debtor number
 * removed (decided later, stays editable elsewhere), status hidden (the phase
 * pills carry the lifecycle choice; status still rides along at its lookup
 * default), a full address card (street/no/suffix/postcode/city/province/
 * country, country→province cascade), "Bedrijfstekst" replacing "Schrijfstijl",
 * and the account manager defaulting to the creating user when assignable. The
 * card regroup (Bedrijf/Adres/Eigenaar/Online/Facturatie), the optional fields
 * (branch/website/employeeCount/toneOfVoice/costCenter/billingEmail) riding
 * along in the SAME whole-form object handed to `onCreate` (unchanged callback
 * contract), the establishment picker actually filtering by typing, and the
 * name validation still blocking an incomplete submit.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { CustomerForm } from './AddCustomerModal'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { NavigationProvider } from '@/context/NavigationContext'
import AddCustomerModal from './AddCustomerModal'
// CUSTOMER-IMPORT-1: only the NETWORK calls are mocked — useImportWizard, UploadStep,
// PreviewStep and ResultStep all run for REAL, so these tests prove the actual wizard
// wiring (dry-run-before-real-run, xlsx rejection, close-on-success), not a stub of it.
import { dryRunImport, runImport } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'], industryOptions: ['Zorg', 'IT'].map(n => ({ value: n, label: n })) }) }))
// CUST-SOURCE-FE-1: the acquisition-source picker, same shape as industry above.
vi.mock('@/lib/useCustomerSources', () => ({
  useCustomerSources: () => ({
    sources: ['LinkedIn', 'Google'].map(n => ({ value: n, label: n })), allowFreeEntry: false, invalidate: vi.fn(),
  }),
}))
// useLocations is react-query-backed (@tanstack/react-query) — mocked directly
// so this test doesn't need a QueryClientProvider ancestor.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }, { value: 'loc-2', label: 'Vestiging Zuid' }],
}))
// KLANT-FASE-1: TENANT-RENAMED phases — the is_default row is NOT first and is NOT
// called 'prospect', so a slug/index-based default would pick the wrong one.
vi.mock('@/lib/useCustomerPhases', async () => {
  const { customerPhases, phaseFallbackColor } = await import('./AddCustomerModal.testKit')
  return {
    useCustomerPhases: () => ({
      phases: customerPhases,
      phaseMeta: (v?: string | null) => ({ value: v ?? '', label: v ?? '', color: phaseFallbackColor, isCustomer: false, isDefault: false }),
      defaultPhase: 'interesse',
      isCustomerPhase: (v?: string | null) => v === 'vaste_klant',
      loading: false,
    }),
  }
})
// COUNTRY/PROVINCE cascade — mirrors the candidate modal's own province mock.
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Utrecht', 'Zuid-Holland'] }) }))
// COLLAPSIBLE-TEXT-1: Tiptap needs a real browser to mount — stubbed with a plain
// controlled textarea, mirrors the house convention (AddLocationModal.test.tsx /
// MatchModal.test.tsx). CollapsibleRichText itself runs for REAL, so these tests
// prove the actual collapsed-ghost -> reveal -> submit wiring, not a stub of it.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
// ACCOUNTMANAGER-DEFAULT-1: `authState.user` is mutable per-test (vi.hoisted so the
// hoisted vi.mock factory below can read the CURRENT value, not a snapshot).
// CUSTOMER-IMPORT-1: hasPermission defaults to "allow everything" so the pre-existing
// tests above (none of which touch the import card) keep behaving as before; the
// import describe block below overrides it per test to exercise the gate itself.
const { authState } = vi.hoisted(() => ({
  authState: {
    user: { id: 'u1', name: 'Piet Recruiter' } as { id: string; name: string } | null,
    hasPermission: (() => true) as (perm: string) => boolean,
  },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authState.user, hasPermission: authState.hasPermission }) }))

// CUST-DUP-FE-1 (22-08): the duplicate probe + restore hooks talk to the real axios
// client — mock the seam so these tests can assert the REQUEST, not just a callback
// (mirrors AddCandidateModal.test.tsx's own getMock/postMock).
const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { get: getMock, post: postMock } }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The reused import-wizard steps (PreviewStep/ResultStep) are in the 'settings' bundle.

const users = [{ id: 'u1', name: 'Piet Recruiter' }]
const statuses = [{ value: 'actief', label: 'Actief' }]

// Every test starts with the logged-in user assignable (the pre-02-08 baseline
// behaviour); the owner-default describe block below overrides this per test.
beforeEach(() => {
  authState.user = { id: 'u1', name: 'Piet Recruiter' }
  authState.hasPermission = () => true
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
  getMock.mockReset()
  postMock.mockReset()
  // Benign GET default — the duplicate probe itself always POSTs (asserted below);
  // any incidental GET the modal fires resolves harmlessly to "no match".
  getMock.mockResolvedValue({ data: { exists: false, match: null } })
  postMock.mockResolvedValue({ data: {} })
})

describe('AddCustomerModal · duplicate probe (CUST-DUP-FE-1)', () => {
  it('probes POST /customers/check-duplicate with the exact debounced body', async () => {
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Rivas Zorggroep')
    await user.type(screen.getByLabelText(ct('overview.coc'), { exact: false }), '12345678')
    // Real debounce (500ms) — wait past it rather than faking timers, mirrors
    // AddCandidateModal.test.tsx's own probe test technique.
    await new Promise(r => setTimeout(r, 700))
    await waitFor(() => expect(postMock).toHaveBeenCalledWith(
      '/customers/check-duplicate',
      { name: 'Rivas Zorggroep', coc_number: '12345678', billing_email: undefined },
      expect.objectContaining({ signal: expect.anything() }),
    ))
  })

  // PII-REGRESSIE (mirrors the candidate guard): coc/billing details must never
  // travel as a query string (§7) — the probe only ever calls the POST variant.
  it('never probes over the GET route', async () => {
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Rivas Zorggroep')
    await new Promise(r => setTimeout(r, 700))
    const probedViaGet = getMock.mock.calls.some(([url]) => String(url).includes('check-duplicate'))
    expect(probedViaGet).toBe(false)
  })
})

// C-29-equivalent: the 409 used to dump the server's Dutch sentence into the error
// banner and throw the `existing` payload away. It must now render a translated
// panel with real actions built from that payload — mirrors AddCandidateModal 1:1.
describe('AddCustomerModal · duplicate 409 panel (CUST-DUP-FE-1)', () => {
  const mountWithNav = (onCreate: Mock<(form: CustomerForm) => unknown>, onClose = vi.fn()) => {
    const goTo = vi.fn()
    render(
      <NavigationProvider goTo={goTo}>
        <AddCustomerModal onClose={onClose} onCreate={onCreate} users={users} statuses={statuses} />
      </NavigationProvider>
    )
    return { goTo, onClose }
  }

  // Fill the one required field and submit.
  const submit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Zorg Almere B.V.')
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
  }

  const reject409 = (existing: Record<string, unknown> | undefined) =>
    vi.fn().mockRejectedValue({ response: { status: 409, data: { message: 'Klant bestaat al', existing } } })

  it('renders the translated panel with the duplicate name — never the raw server sentence', async () => {
    const onCreate = reject409({ id: 'dup-1', name: 'Zorg Gorinchem', archived: false })
    const user = userEvent.setup()
    mountWithNav(onCreate)
    await submit(user)
    expect(await screen.findByText(ct('duplicate.blockedTitle'))).toBeInTheDocument()
    expect(screen.getByText('Zorg Gorinchem')).toBeInTheDocument()
    expect(screen.getByText(ct('duplicate.stateActive'))).toBeInTheDocument()
    // The regression that matters: the untranslated server message is gone.
    expect(screen.queryByText('Klant bestaat al')).not.toBeInTheDocument()
  })

  it('"open existing" navigates to that customer and closes the create form', async () => {
    const onCreate = reject409({ id: 'dup-1', name: 'Zorg Gorinchem', archived: false })
    const user = userEvent.setup()
    const { goTo, onClose } = mountWithNav(onCreate)
    await submit(user)
    await user.click(await screen.findByRole('button', { name: ct('duplicate.open') }))
    expect(goTo).toHaveBeenCalledWith('customers', { open: 'dup-1' })
    expect(onClose).toHaveBeenCalled()
  })

  it('an archived duplicate says so and restores via POST /customers/{id}/restore', async () => {
    const onCreate = reject409({ id: 'dup-2', name: 'Zorg Woerden', archived: true })
    const user = userEvent.setup()
    const { goTo } = mountWithNav(onCreate)
    await submit(user)
    expect(await screen.findByText(ct('duplicate.stateArchived'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ct('duplicate.restoreAndOpen') }))
    // Assert the REQUEST (method + route), then the follow-up navigation.
    await waitFor(() => expect(postMock).toHaveBeenCalledWith('/customers/dup-2/restore', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
    await waitFor(() => expect(goTo).toHaveBeenCalledWith('customers', { open: 'dup-2' }))
  })

  it('hides restore (but keeps open) without the customers.update permission', async () => {
    authState.hasPermission = (perm: string) => perm !== 'customers.update'
    const onCreate = reject409({ id: 'dup-2', name: 'Zorg Woerden', archived: true })
    const user = userEvent.setup()
    mountWithNav(onCreate)
    await submit(user)
    expect(await screen.findByRole('button', { name: ct('duplicate.open') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: ct('duplicate.restoreAndOpen') })).not.toBeInTheDocument()
    // Assert the RESTORE seam specifically — this submit fills `name`, a probe
    // field, so a blanket not-called would race the 500ms probe debounce.
    expect(postMock.mock.calls.some(([url]) => String(url).includes('/restore'))).toBe(false)
  })

  it('a 409 without an `existing` payload still shows our own translated line', async () => {
    const onCreate = reject409(undefined)
    const user = userEvent.setup()
    mountWithNav(onCreate)
    await submit(user)
    expect(await screen.findByText(ct('duplicate.blockedTitle'))).toBeInTheDocument()
    expect(screen.queryByText('Klant bestaat al')).not.toBeInTheDocument()
  })

  it('a non-409 rejection still takes the generic error path', async () => {
    const onCreate = vi.fn().mockRejectedValue({ response: { data: { message: 'Er ging iets mis op de server' } } })
    const user = userEvent.setup()
    mountWithNav(onCreate)
    await submit(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('Er ging iets mis op de server')
    expect(screen.queryByText(ct('duplicate.blockedTitle'))).not.toBeInTheDocument()
  })

  // ONIX N-005: a 422 bag key no form field maps to (a required tenant custom
  // field) must still surface as a banner, never a silent failed submit.
  it('shows a banner for a 422 key no field renders (unmapped custom field)', async () => {
    const onCreate = vi.fn().mockRejectedValue({
      response: { data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } },
    })
    const user = userEvent.setup()
    mountWithNav(onCreate)
    await submit(user)
    expect(await screen.findByRole('alert')).toHaveTextContent("vog")
    // ONIX N-005 verifier: no field renders the dotted key as a red-bordered input.
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull()
  })
})
