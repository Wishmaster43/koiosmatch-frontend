/** AddCustomerModal · optional pickers, owner default, phase, KvK and source (split from AddCustomerModal.test.tsx; resolves copy through the active locale's own i18n). */
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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
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
const cm = (key: string) => i18n.t(key, { ns: 'common' })
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

// CLEAR-SWEEP (Danny 13-08): industry/province/country/owner are optional pickers —
// each carries a real clear cross once picked, and clearing must reach the create
// body as "left out" (CONSIST-2, verified in useCustomerRecord.test.ts), not just
// reset the on-screen trigger. Mirrors OpportunityGeneralCard's own clear test.
describe('AddCustomerModal · CLEAR-SWEEP optional pickers clear back to placeholder', () => {
  it('pick then clear the industry picker', async () => {
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    await user.click(screen.getByRole('button', { name: new RegExp(ct('modal.fields.industry')) }))
    await user.click(await screen.findByRole('button', { name: 'Zorg' }))
    expect(screen.getByText('Zorg')).toBeInTheDocument()

    const clear = within(screen.getByText(ct('modal.fields.industry')).parentElement as HTMLElement).getByTitle(i18n.t('clearField', { ns: 'common', field: ct('modal.fields.industry') }))
    await user.click(clear)
    expect(screen.getByText(ct('modal.fields.selectIndustry'))).toBeInTheDocument()
  })

  it('pick then clear the account manager picker', async () => {
    authState.user = { id: 'super-admin-1', name: 'Super Admin' } // not auto-proposed, stays empty until picked
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    await user.click(screen.getByRole('button', { name: new RegExp(ct('modal.fields.accountManager')) }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()

    const clear = within(screen.getByText(ct('modal.fields.accountManager')).parentElement as HTMLElement).getByTitle(i18n.t('clearField', { ns: 'common', field: ct('modal.fields.accountManager') }))
    await user.click(clear)
    expect(screen.getByText(ct('modal.fields.selectOwner'))).toBeInTheDocument()
  })

  it('pick then clear the province/country pickers, and the create body omits both when left empty', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Rivas Zorggroep')

    await user.click(screen.getByRole('button', { name: new RegExp(ct('locations.detail.country')) }))
    await user.click(await screen.findByRole('button', { name: 'Nederland' }))
    await user.click(screen.getByRole('button', { name: new RegExp(ct('locations.detail.state')) }))
    await user.click(await screen.findByRole('button', { name: 'Utrecht' }))

    const clearProvince = within(screen.getByText(ct('locations.detail.state')).parentElement as HTMLElement).getByTitle(i18n.t('clearField', { ns: 'common', field: ct('locations.detail.state') }))
    await user.click(clearProvince)
    expect(screen.getByText(cm('select'))).toBeInTheDocument()
    const clearCountry = within(screen.getByText(ct('locations.detail.country')).parentElement as HTMLElement).getByTitle(i18n.t('clearField', { ns: 'common', field: ct('locations.detail.country') }))
    await user.click(clearCountry)

    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ province: '', country: '' }))
  })
})

describe('AddCustomerModal · account manager defaults to the creator (Danny 02-08)', () => {
  // ACCOUNTMANAGER-DEFAULT-1: "Accountmanager moet voorstel waarde zijn van de
  // gebruiker die hem aanmaakt" — but only a PROPOSAL, and only when the logged-in
  // user is actually assignable (present in the tenant's `users` list); otherwise
  // the create would 422 (owner_id validated against tenant users).
  it('pre-selects the current user as owner when they are in the assignable users list', () => {
    authState.user = { id: 'u1', name: 'Piet Recruiter' }
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()
  })

  it('leaves the owner empty when the current user is not in the assignable users list', () => {
    authState.user = { id: 'super-admin-1', name: 'Super Admin' }
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument()
    // The picker still renders — just unfilled, showing its own placeholder.
    expect(screen.getByText(ct('modal.fields.selectOwner'))).toBeInTheDocument()
  })

  it('never overwrites an owner the recruiter already picked, even once assignability resolves afterwards', async () => {
    // Starts NOT assignable ('u1' is not yet in the list — e.g. the users list is
    // still loading) so nothing gets auto-proposed; the recruiter picks someone
    // (a DIFFERENT user, 'u2') by hand while the effect stays dormant.
    authState.user = { id: 'u1', name: 'Danny Superadmin' }
    const user = userEvent.setup()
    const otherUser = [{ id: 'u2', name: 'Piet Recruiter' }]
    const { rerender } = render(<AddCustomerModal onClose={() => {}} users={otherUser} statuses={statuses} />)
    await user.click(screen.getByRole('button', { name: new RegExp(ct('modal.fields.accountManager')) }))
    await user.click(await screen.findByRole('button', { name: 'Piet Recruiter' }))
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()

    // The tenant users list resolves and NOW includes 'u1' too — meIsAssignable
    // flips true, but the functional "only while still empty" update must not
    // clobber the recruiter's own pick.
    rerender(<AddCustomerModal onClose={() => {}} users={[...otherUser, { id: 'u1', name: 'Danny Superadmin' }]} statuses={statuses} />)
    expect(screen.getByText('Piet Recruiter')).toBeInTheDocument()
  })
})

describe('AddCustomerModal · lifecycle phase (KLANT-FASE-1)', () => {
  // Danny 02-08: "die fase moet zijn zoals + nieuwe kandidaat" — two pills top right, and
  // the title names the choice, instead of a dropdown buried in a card he walked past twice.
  it('pre-selects the is_default phase — read off the flag, not the "prospect" slug', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    // The pill is pressed…
    expect(screen.getByRole('button', { name: 'Interesse' })).toHaveAttribute('aria-pressed', 'true')
    // …and the title says which kind of record you are creating.
    expect(screen.getByText(`${ct('modal.title')} — Interesse`)).toBeInTheDocument()
  })

  it('hands the picked phase to onCreate in the same whole-form object', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Zorgpartners')
    await user.click(screen.getByRole('button', { name: 'Vaste klant' }))
    expect(screen.getByRole('button', { name: 'Vaste klant' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ phase: 'vaste_klant' }))
  })
})

// CUST-DUP-FE-1 (22-08): the duplicate-check regime AddCandidateModal already had —
// probe endpoint + create-409 + restore — extended to customers 1:1 (backend contract
// live, commit e4f4bb1c).
describe('AddCustomerModal · KvK number field (CUST-DUP-FE-1)', () => {
  it('renders an optional KvK/CoC number field and hands it to onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Rivas Zorggroep')
    await user.type(screen.getByLabelText(ct('overview.coc'), { exact: false }), '12345678')
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ cocNumber: '12345678' }))
  })
})

// CUST-SOURCE-FE-1: acquisition source is a searchable/creatable picker like
// industry — picking one hands it to onCreate; leaving it untouched sends the
// empty default (filtered out of the real POST body downstream, useCustomerRecord.test.ts).
describe('AddCustomerModal · acquisition source field (CUST-SOURCE-FE-1)', () => {
  it('picking a source hands it to onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('modal.fields.source')) }))
    await user.click(await screen.findByRole('button', { name: 'LinkedIn' }))
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ source: 'LinkedIn' }))
  })

  it('leaves source empty when never touched', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Rivas Zorggroep')
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ source: '' }))
  })
})
