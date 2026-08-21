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
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddCustomerModal from './AddCustomerModal'
// CUSTOMER-IMPORT-1: only the NETWORK calls are mocked — useImportWizard, UploadStep,
// PreviewStep and ResultStep all run for REAL, so these tests prove the actual wizard
// wiring (dry-run-before-real-run, xlsx rejection, close-on-success), not a stub of it.
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/importeren/importApi'

vi.mock('@/pages/settings/sections/importeren/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/importeren/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'] }) }))
// useLocations is react-query-backed (@tanstack/react-query) — mocked directly
// so this test doesn't need a QueryClientProvider ancestor.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }, { value: 'loc-2', label: 'Vestiging Zuid' }],
}))
// KLANT-FASE-1: TENANT-RENAMED phases — the is_default row is NOT first and is NOT
// called 'prospect', so a slug/index-based default would pick the wrong one.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false },
      { value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true },
    ],
    phaseMeta: (v?: string | null) => ({ value: v ?? '', label: v ?? '', color: '#9CA3AF', isCustomer: false, isDefault: false }),
    defaultPhase: 'interesse',
    isCustomerPhase: (v?: string | null) => v === 'vaste_klant',
    loading: false,
  }),
}))
/* eslint-enable no-restricted-syntax */
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock allows every permission; the param exists only to match hasPermission's real signature (tsc's noUnusedParameters already exempts the leading underscore)
    hasPermission: ((_perm: string) => true) as (perm: string) => boolean,
  },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authState.user, hasPermission: authState.hasPermission }) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })
// The reused import-wizard steps (PreviewStep/ResultStep) are in the 'settings' bundle.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const users = [{ id: 'u1', name: 'Piet Recruiter' }]
const statuses = [{ value: 'actief', label: 'Actief' }]

// Every test starts with the logged-in user assignable (the pre-02-08 baseline
// behaviour); the owner-default describe block below overrides this per test.
beforeEach(() => {
  authState.user = { id: 'u1', name: 'Piet Recruiter' }
  authState.hasPermission = () => true
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

describe('AddCustomerModal · titled cards (Danny 02-08: mirrors AddCandidateModal)', () => {
  it('groups the fields into Bedrijf / Adres / Eigenaar / Online / Facturatie', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.getByText(ct('modal.fields.cardCompany'))).toBeInTheDocument()
    // The address card reuses the drawer's own "Adres" heading (overview.address) —
    // there is no more modal-only "cardCity" key (ONE label per thing).
    expect(screen.getByText(ct('overview.address'))).toBeInTheDocument()
    expect(screen.getByText(ct('modal.fields.cardOwner'))).toBeInTheDocument()
    expect(screen.getByText(ct('overview.online'))).toBeInTheDocument()
    expect(screen.getByText(ct('overview.billing'))).toBeInTheDocument()
  })
})

// HET-RECEPT (Danny 14-08, MatchModal is the reference): every field row is a
// label-LEFT row via the shared FieldRow (components/forms/fields) — the canon
// label column (fixed 120px width) sits BEFORE the field in DOM order, never
// stacked above it. Card-structure regression test for the layout sweep.
describe('AddCustomerModal · card structure follows HET-RECEPT (label-left FieldRow)', () => {
  it('renders the name label at the canon label width, immediately before its field', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    const label = screen.getByText(ct('modal.fields.name'))
    expect(label.tagName).toBe('LABEL')
    expect(label.style.width).toBe('120px')
    const row = label.parentElement as HTMLElement
    expect(row.style.display).toBe('flex')
    expect(row.style.flexDirection).not.toBe('column')
    // The field sits as the label's next sibling within the row, not above it.
    expect(row.children[0]).toBe(label)
    expect(row.children.length).toBeGreaterThan(1)
  })
})

describe('AddCustomerModal · debtor number removed (Danny 02-08)', () => {
  // DEBITEURNUMMER-1: the field's old hardcoded placeholder ("10042") is a
  // language-independent fingerprint — if it is found, the field is still there.
  it('no longer collects the debtor number at creation', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.queryByPlaceholderText('10042')).not.toBeInTheDocument()
  })
})

describe('AddCustomerModal · status hidden, default still sent (Danny 02-08)', () => {
  // STATUS-HIDDEN-1: no picker for it anymore — 'Actief' (the fixture's only status
  // label) would only ever appear as a picker's pre-selected trigger text, so its
  // absence proves the picker is gone (not just relabelled).
  it('renders no status picker', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
  })

  // The default must come off the lookup's is_default FLAG (mirrors the candidate's
  // phase default), not "whichever status sorts first" — this fixture puts the
  // flagged row SECOND on purpose.
  it('still sends the lookup-flagged default status on create, never empty or invented', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    const flaggedStatuses = [
      { value: 'inactief', label: 'Inactief' },
      { value: 'actief', label: 'Actief', isDefault: true },
    ]
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={flaggedStatuses} />)
    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Zorgpartners')
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ status: 'actief' }))
  })
})

describe('AddCustomerModal · validation', () => {
  it('blocks submit while the name is empty', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    const createBtn = screen.getByRole('button', { name: ct('modal.create') })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })
})

// VALIDATIE-LIVE-1-rest (2026-08-08): billingEmail is the one field on this form
// the backend validates with a shape rule — a malformed value now shows a live,
// on-blur inline error and blocks the create instead of only bouncing back as a 422.
describe('AddCustomerModal · live e-mail format validation (VALIDATIE-LIVE-1-rest)', () => {
  it('shows an inline error under Facturatie e-mail once blurred with a malformed value, and disables Create', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    await user.type(screen.getByPlaceholderText(cm('placeholders.companyNameExample')), 'Rivas Zorggroep')
    const emailField = screen.getByLabelText(ct('overview.billingEmail'), { exact: false })
    await user.type(emailField, 'not-an-email')
    fireEvent.focusOut(emailField)
    expect(await screen.findByRole('alert')).toHaveTextContent(/.+/)
    expect(screen.getByRole('button', { name: ct('modal.create') })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('a well-formed e-mail never blocks submit', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)
    await user.type(screen.getByPlaceholderText(cm('placeholders.companyNameExample')), 'Rivas Zorggroep')
    const emailField = screen.getByLabelText(ct('overview.billingEmail'), { exact: false })
    await user.type(emailField, 'facturen@rivas.nl')
    fireEvent.focusOut(emailField)
    await user.click(screen.getByRole('button', { name: ct('modal.create') }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
  })
})

describe('AddCustomerModal · vestiging als eigen blok onderaan (Danny 02-08)', () => {
  // The branch left the address card and became its own block at the bottom, exactly as the
  // candidate modal does it: an add trigger beside the heading, a removable chip, and the
  // sentence that says what leaving it EMPTY means — empty is a real choice here.
  it('adds and removes the branch as a chip, and explains what empty means', async () => {
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)

    expect(screen.getByText(ct('modal.fields.branchAutoHint'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ct('modal.fields.branchAdd') }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Zuid' }))
    await user.keyboard('{Escape}')

    // The chip is the element carrying the remove button — the picker still lists the same
    // label, so match on the chip itself rather than on any text.
    const remove = screen.getByRole('button', { name: cm('remove') })
    expect(remove.parentElement).toHaveTextContent('Vestiging Zuid')
    expect(screen.queryByText(ct('modal.fields.branchAutoHint'))).toBeNull()

    await user.click(remove)
    expect(screen.getByText(ct('modal.fields.branchAutoHint'))).toBeInTheDocument()
  })
})

describe('AddCustomerModal · new fields ride along in the whole form object (Danny 27-07 addendum)', () => {
  it('hands onCreate the extended form incl. branch/website/employeeCount/toneOfVoice/costCenter/billingEmail', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Stichting Rivas Zorggroep')
    await user.type(screen.getByLabelText(ct('overview.website'), { exact: false }), 'https://rivas.nl')
    await user.type(screen.getByLabelText(ct('overview.employeeCount'), { exact: false }), '250')
    // BEDRIJFSTEKST-1 (Danny 02-08): the field's card is now "Bedrijfstekst"
    // (overview.companyText) — "Schrijfstijl" (overview.toneOfVoice) is gone —
    // and COLLAPSIBLE-TEXT-1 (02-08 round 2) makes it a collapsed ghost, same
    // shape as +Match's Opmerkingen: click to reveal, then type.
    await user.click(screen.getByRole('button', { name: cm('add') }))
    await user.type(screen.getByLabelText('rich-text-editor'), 'Formeel')
    await user.type(screen.getByLabelText(ct('overview.costCenter'), { exact: false }), 'CC-42')
    await user.type(screen.getByLabelText(ct('overview.billingEmail'), { exact: false }), 'facturen@rivas.nl')

    // Pick the establishment too, so branchId also proves it survives into the payload —
    // now from its own block at the bottom.
    await user.click(screen.getByRole('button', { name: ct('modal.fields.branchAdd') }))
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))

    await user.click(screen.getByRole('button', { name: ct('modal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Stichting Rivas Zorggroep',
      branchId: 'loc-1',
      website: 'https://rivas.nl',
      employeeCount: '250',
      toneOfVoice: 'Formeel',
      costCenter: 'CC-42',
      billingEmail: 'facturen@rivas.nl',
    }))
  })
})

// COLLAPSIBLE-TEXT-1 (Danny 02-08): "Bedrijfstekst" gets the exact same collapsed
// ghost affordance as +Match's Opmerkingen — always present, near-zero height
// until clicked, never auto-opens.
describe('AddCustomerModal · Bedrijfstekst starts collapsed (COLLAPSIBLE-TEXT-1)', () => {
  it('does not render the rich-text editor before the recruiter opens it', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.queryByLabelText('rich-text-editor')).toBeNull()
    expect(screen.getByRole('button', { name: cm('add') })).toBeInTheDocument()
  })

  it('reveals the shared RichTextEditor (never a bare textarea) on an explicit click', async () => {
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    await user.click(screen.getByRole('button', { name: cm('add') }))
    expect(screen.getByLabelText('rich-text-editor')).toBeInTheDocument()
  })
})

describe('AddCustomerModal · own address block (Danny 02-08: mirrors AddCandidateModal AddressCard)', () => {
  it('renders street/house number/suffix/postcode/city/province/country and hands them to onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddCustomerModal onClose={() => {}} onCreate={onCreate} users={users} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('modal.fields.name'), { exact: false }), 'Rivas Zorggroep')
    await user.type(screen.getByLabelText(ct('locations.detail.street'), { exact: false }), 'Kerkstraat')
    await user.type(screen.getByLabelText(ct('locations.detail.houseNumber'), { exact: false }), '12')
    await user.type(screen.getByLabelText(ct('locations.detail.houseNumberSuffix'), { exact: false }), 'A')
    await user.type(screen.getByLabelText(ct('locations.detail.postalCode'), { exact: false }), '4201 AB')
    // Exact match here (not `{ exact: false }`): "Plaats" is a SUBSTRING of "Kostenplaats"
    // (overview.costCenter, in the Facturatie card), so a fuzzy match finds both fields.
    await user.type(screen.getByLabelText(ct('modal.fields.city')), 'Gorinchem')

    // Province is a searchable combobox cascaded on country — no country picked yet,
    // so it stays a plain empty picker (mirrors the candidate's own cascade). The
    // trigger's accessible name is "<label> <value-or-placeholder>" (CreatableSelect
    // concatenates them), hence the RegExp instead of an exact match.
    await user.click(screen.getByRole('button', { name: new RegExp(ct('locations.detail.country')) }))
    await user.click(await screen.findByRole('button', { name: 'Nederland' }))
    await user.click(screen.getByRole('button', { name: new RegExp(ct('locations.detail.state')) }))
    await user.click(await screen.findByRole('button', { name: 'Utrecht' }))

    await user.click(screen.getByRole('button', { name: ct('modal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      street: 'Kerkstraat', houseNumber: '12', houseNumberSuffix: 'A',
      postalCode: '4201 AB', city: 'Gorinchem', province: 'Utrecht', country: 'NL',
    }))
  })
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

describe('AddCustomerModal · import card (Danny 02-08: replaces the italic import hint with a real importer)', () => {
  // KLANT-LAYOUT-2 (Danny 03-08): the card now lives inside a CollapsedCard, closed
  // by default — every test below must open it before it can query the card's contents.
  const importCardTitle = ct('modal.import.title')
  const csvFile = new File(['klant_naam,straat\nAcme,Kerkstraat 1'], 'acme.csv', { type: 'text/csv' })
  const xlsxFile = new File(['binary'], 'acme.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  // A dry run that would land one row — enough to unlock the real-import confirm.
  const cleanResult: ImportRunResult = {
    entity: 'customer_tree', dry_run: true,
    summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
    unknown_columns: [],
    rows: [{ row: 1, action: 'create', reference: 'Acme', id: null, messages: [] }],
  }

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))
    const input = screen.getByLabelText(st('import.selectCsv')) as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('accepts an .xlsx file dropped in — this card only forwards the raw File, never parses it client-side', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    // Dropped rather than picked via the file dialog: drag-and-drop bypasses the
    // input's `accept` filter entirely, so this exercises the component's OWN
    // extension check, not just the OS picker.
    const dropZone = screen.getByText(ct('modal.import.intro')).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [xlsxFile] } })

    expect(screen.queryByText(st('import.wrongFileType'))).not.toBeInTheDocument()
    expect(screen.getByText(st('import.fileSelected', { name: 'acme.xlsx' }))).toBeInTheDocument()
  })

  it('refuses a genuinely unsupported file type client-side, and never calls the dry run', () => {
    const pdfFile = new File(['binary'], 'acme.pdf', { type: 'application/pdf' })
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    const dropZone = screen.getByText(ct('modal.import.intro')).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [pdfFile] } })

    expect(screen.getByText(st('import.wrongFileType'))).toBeInTheDocument()
    expect(dryRunImport).not.toHaveBeenCalled()
  })

  it('never reaches the real import before the mandatory dry run succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    await user.click(screen.getByRole('button', { name: importCardTitle }))

    // Before any file is picked, no confirm/real-import control exists at all —
    // there is no shortcut straight to runImport.
    expect(screen.queryByRole('button', { name: st('import.preview.confirm') })).not.toBeInTheDocument()

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))

    expect(dryRunImport).toHaveBeenCalledTimes(1)
    expect(runImport).not.toHaveBeenCalled()
    // ONLY once the dry run has resolved does the real-import control appear.
    expect(await screen.findByRole('button', { name: st('import.preview.confirm') })).toBeInTheDocument()
  })

  it('closes the modal and refreshes the list once a real import lands something', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onImported = vi.fn()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    vi.mocked(runImport).mockResolvedValue({
      ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'c1' }],
    })

    render(<AddCustomerModal onClose={onClose} onImported={onImported} users={users} statuses={statuses} />)
    await user.click(screen.getByRole('button', { name: importCardTitle }))

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))
    await user.click(await screen.findByRole('button', { name: st('import.preview.confirm') }))

    // The auto-close effect fires once the run RESULT lands something — never
    // leaving the untouched manual form open behind a customer that now exists.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(runImport).toHaveBeenCalledTimes(1)
  })

  it('gates the picker on customers.create: disabled, with the honest notice, not a button that would 403', () => {
    authState.hasPermission = (perm: string) => perm !== 'customers.create'
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    expect(screen.getByLabelText(st('import.selectCsv'))).toBeDisabled()
    expect(screen.getByText(st('import.noImportPermission'))).toBeInTheDocument()
  })

  // KLANT-LAYOUT-2 (Danny 03-08): the import card is secondary/optional, so it
  // starts collapsed — verifies the CollapsedCard wiring itself, not just the
  // open-then-assert pattern the other tests above now use.
  it('the import card starts collapsed', () => {
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    expect(screen.queryByLabelText(st('import.selectCsv'))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: importCardTitle })).toHaveAttribute('aria-expanded', 'false')
  })
})
