/**
 * AddContactPersonModal — covers the house "wide form" adoption (Danny 27-07):
 * the card regroup (Persoon/Contact/Koppeling) still submits the exact same
 * ContactPayload shape via `onCreate`, the location picker (bare <select> before,
 * now a searchable CreatableSelect, allowCreate={false}) actually filters by
 * typing, and the first/last-name validation still blocks an incomplete submit.
 *
 * Danny 27-07 (customer-list point 9, "contactpersoon volgt klant of afdeling"):
 * the department picker must CASCADE off the picked location, mirroring
 * AddShiftModal's customer->department dependent picker — see the block below
 * covering that narrowing/reset/submit behaviour.
 *
 * Danny 28-07: three more cases. (1) locking the location (adding "at this
 * location") must hide ONLY the location picker, never the department picker
 * alongside it. (2) the "primair contact" toggle asks via the shared confirm
 * dialog before replacing whichever OTHER contact currently holds the flag.
 * (3) a client-side duplicate check on email/phone/mobile (scoped to the
 * customer's OTHER contacts via the new `existing` prop) blocks submit before
 * the server's 422 would.
 *
 * Danny 02-08 addition covered here: a CSV import card (mirrors AddLocationModal's
 * own — same shared wizard/card, same parent-mismatch safety net, entity="contacts"),
 * and the status picker hiding by default (STATUS-HIDDEN-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddContactPersonModal from './AddContactPersonModal'
import type { Contact, Department } from '@/types/customer'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — the real wizard/steps run,
// so these tests prove the actual wiring (dry-run-before-real-run, xlsx rejection,
// close-on-success, parent-mismatch), not a stub of it (mirrors AddLocationModal.test.tsx).
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/importeren/importApi'

// Both hooks fired by useContactFunctions (contact-functions + tenant settings)
// hit the module-scope cached-lookup path — a harmless empty response keeps
// each hook on its own seed fallback, same as before this change.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/pages/settings/sections/importeren/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/importeren/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})
// hasPermission defaults to "allow everything" so the pre-existing tests above (none of
// which touch the import card) keep behaving as before; the import describe block below
// overrides it per test to exercise the gate itself.
const { authState, settingsState } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock allows every permission; the param exists only to match hasPermission's real signature
  authState: { hasPermission: ((_perm: string) => true) as (perm: string) => boolean },
  // STATUS-HIDDEN-1: the settings blob a test can flip per-case (e.g. tenant marks
  // status_id required) — defaults to empty (nothing required).
  settingsState: { settings: {} as Record<string, unknown> },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: authState.hasPermission }) }))
// Keep the REAL getJsonSetting (the component parses the required-fields config
// through it); only the settings blob itself is test-controlled.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => settingsState.settings }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The reused import-wizard steps (PreviewStep/ResultStep) are in the 'settings' bundle.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

// Minimal-but-type-complete Department fixture — only the cascade-relevant fields
// (id/name/locationId) vary per test; everything else is a harmless default.
const dept = (id: string, name: string, locationId: string): Department => ({
  id, helloflexLink: null, shiftmanagerLink: null, name, description: '', locationId, locationName: '',
  contacts: [], costCenter: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
})
const departments = [dept('dep-1', 'Verpleging', 'loc-1'), dept('dep-2', 'Thuiszorg', 'loc-2')]

// Minimal-but-type-complete Contact fixture for the `existing` prop (the customer's
// OTHER already-loaded contacts) — drives the primary-replace confirm and the
// email/phone/mobile duplicate check.
const contact = (overrides: Partial<Contact>): Contact => ({
  id: 'c-other', helloflexLink: null, shiftmanagerLink: null, firstName: 'Anna', middleName: '', lastName: 'Bakker', name: 'Anna Bakker',
  // CONTACT-GESLACHT-1 + the merge scope id — both required on Contact now.
  customerId: 'cust-1', gender: '',
  role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  lastContactAt: null, lastContactType: null,
  ...overrides,
})

describe('AddContactPersonModal', () => {
  it('blocks submit while first/last name are empty and shows the required message', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    // Typing only the first name still leaves the button disabled (last name missing).
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the location picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // Trigger's name is now the field label (aria-labelledby self-reference drops
    // its own visible text) — location and department each get their OWN distinct
    // label now, so no more index-into-getAllByRole needed to tell them apart.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))

    const search = screen.getByPlaceholderText(ct('subModal.noneOption'))
    await user.type(search, 'Noord')

    expect(screen.getByRole('button', { name: 'Locatie Noord' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Zuid' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('subModal.selectLocation') })).toHaveTextContent('Locatie Noord')
  })

  it('submits the same ContactPayload shape via onCreate once required fields are filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    // Pick the location to prove the field still lands in the payload after
    // becoming a CreatableSelect. Trigger's name is the field label now.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Jan', middleName: '', lastName: 'Jansen', locationId: 'loc-1',
    }))
  })

  it('the department picker follows the selected location (C-42/point-9 cascade)', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    // Before any location is picked: the department field offers NOTHING to pick
    // (never "every department of this customer" — a department belongs to exactly
    // one location) and its search box asks for a location first.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByPlaceholderText(ct('subModal.pickLocationFirst'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verpleging' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Pick "Locatie Noord" — the department list narrows to ONLY that location's department.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByRole('button', { name: 'Verpleging' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('changing the location resets a department that no longer belongs to it', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    // Pick Noord -> Verpleging.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent('Verpleging')

    // Switching to Zuid must clear the now-invalid "Verpleging" pick — never silently
    // submit a department that belongs to a different location.
    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).not.toHaveTextContent('Verpleging')
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent(ct('subModal.noneOption'))
  })

  it('submits the payload with the matching customer_location_id/customer_department_id pair', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // ContactPayload carries camelCase locationId/departmentId here; useCustomerContacts'
    // own toApi (covered by its own hook test) maps these onto customer_location_id/
    // customer_department_id on the actual POST body.
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      locationId: 'loc-1', departmentId: 'dep-1',
    }))
  })

  it('edit mode still resolves a legacy department whose location link is missing (CONTACT-MULTI-1 drawer chip-select has no cascade)', () => {
    // A contact edited via the drawer's independent chip-select could carry a
    // department without a matching location — the picker must still show its
    // real label, never fall back to rendering the raw id.
    const initial = {
      id: 'c1', helloflexLink: null, shiftmanagerLink: null, firstName: 'Jan', middleName: '', lastName: 'Jansen', name: 'Jan Jansen',
      // CONTACT-GESLACHT-1 + the merge scope id — both required on Contact now.
      customerId: 'cust-1', gender: '',
      role: '', email: '', phone: '', mobile: '', isPrimary: false,
      locationId: null, locationName: '', departmentId: 'dep-1', departmentName: 'Verpleging',
      locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
      lastContactAt: null, lastContactType: null,
    } as Contact

    render(<AddContactPersonModal onClose={() => {}} onCreate={vi.fn()} locations={locations} departments={departments} statuses={statuses} initial={initial} />)

    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent('Verpleging')
  })

  it('locking the location (adding "at this location") hides only the location picker — department still renders and cascades', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} lockLocationId="loc-1" />)

    // Location is pre-filled/hidden; department must still be pickable and already
    // scoped to loc-1 (the location departmentsForLocation cascade off form.locationId).
    expect(screen.queryByRole('button', { name: ct('subModal.selectLocation') })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    expect(screen.getByRole('button', { name: 'Verpleging' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thuiszorg' })).not.toBeInTheDocument()
  })

  it('toggling "primair" ON while another contact is already primary asks first — confirming turns it on', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-primary', name: 'Anna Bakker', isPrimary: true })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    const toggle = screen.getByRole('switch', { name: ct('subModal.isPrimary') })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    // Staged, not yet applied — the toggle must not flip before the user confirms.
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(ct('subModal.primaryReplace.title'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ct('subModal.primaryReplace.confirm') }))
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('cancelling the primary-replace confirmation leaves the toggle off and changes nothing else', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-primary', name: 'Anna Bakker', isPrimary: true })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    const toggle = screen.getByRole('switch', { name: ct('subModal.isPrimary') })
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: ct('subModal.primaryReplace.decline') }))

    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('editing the contact that is ALREADY primary never prompts on save', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    // Same id as `initial` — must be excluded from the "someone else is primary" check.
    const initial = contact({ id: 'c-self', name: 'Jan Jansen', firstName: 'Jan', middleName: '', lastName: 'Jansen', isPrimary: true })
    const existing = [initial]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} initial={initial} existing={existing} />)

    const toggle = screen.getByRole('switch', { name: ct('subModal.isPrimary') })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    // Toggling off and back on for the already-primary contact must never prompt.
    await user.click(toggle)
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(ct('subModal.primaryReplace.title'))).not.toBeInTheDocument()
  })

  it('typing an email that another contact already has shows the duplicate message and blocks submit', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-other', name: 'Anna Bakker', email: 'anna@klant.nl' })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.type(screen.getByLabelText(ct('subModal.email'), { exact: false }), 'anna@klant.nl')

    expect(screen.getByText(ct('subModal.duplicate.email', { name: 'Anna Bakker' }))).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('a phone duplicate is detected on digits only, ignoring punctuation/spacing differences', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    // Same digits as the typed value below, just formatted with a dash/spaces —
    // the digit-only compare must still catch it (a plain string compare would not).
    const existing = [contact({ id: 'c-other', name: 'Anna Bakker', phone: '010-522 97 18' })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.type(screen.getByLabelText(ct('subModal.phone'), { exact: false }), '0105229718')

    expect(screen.getByText(ct('subModal.duplicate.phone', { name: 'Anna Bakker' }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('subModal.create') })).toBeDisabled()
  })

  it('an international-format phone is NOT folded to the same value as a domestic one (plain digit-strip, no country-code normalization)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    const existing = [contact({ id: 'c-other', name: 'Anna Bakker', phone: '+31 10 522 97 18' })]
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.type(screen.getByLabelText(ct('subModal.phone'), { exact: false }), '0105229718')

    // "31105229718" (stripped) !== "0105229718" (stripped) — no duplicate, submit stays enabled.
    expect(screen.queryByText(ct('subModal.duplicate.phone', { name: 'Anna Bakker' }))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('subModal.create') })).not.toBeDisabled()
  })
})

// STATUS-HIDDEN-1 (Danny 02-08, second round): the status picker (inside
// ContactLinkCard) is hidden by default in the create popup — ContactsPanel's
// own status editor already covers create AND edit — and only reappears when
// the tenant marked status_id required (customer_contact_required_fields).
describe('AddContactPersonModal · status picker hidden by default (STATUS-HIDDEN-1)', () => {
  it('does not render a status picker when the tenant has not required it', () => {
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} />)
    expect(screen.queryByText(ct('subModal.status'))).toBeNull()
  })

  it('renders the status picker when the tenant marked status_id required', () => {
    settingsState.settings = { customer_contact_required_fields: JSON.stringify(['status_id']) }
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} />)
    expect(screen.getByText(ct('subModal.status'))).toBeInTheDocument()
  })
})

// CONTACT-TUSSENVOEGSEL-1 (28-07): the backend has stored and returned `middle_name` for
// a while, but the frontend never sent it — so "Jan de Vries" was created as "Jan Vries",
// and editing an existing contact wiped the tussenvoegsel it already had. The seam is the
// PAYLOAD, so that is what this asserts.
describe('AddContactPersonModal · tussenvoegsel', () => {
  it('sends the tussenvoegsel with the create payload', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<AddContactPersonModal onCreate={onCreate} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.middleName'), { exact: false }), 'de')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Vries')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Jan', middleName: 'de', lastName: 'Vries',
    }))
  })

  it('keeps an existing tussenvoegsel when a contact is edited', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    const existing = { id: 'c9', firstName: 'Jan', middleName: 'van der', lastName: 'Berg', name: 'Jan van der Berg' } as never
    render(<AddContactPersonModal initial={existing} onCreate={onCreate} onClose={vi.fn()} />)

    // Change only the first name; the tussenvoegsel must ride along untouched.
    const first = screen.getByLabelText(ct('subModal.firstName'), { exact: false })
    await user.clear(first)
    await user.type(first, 'Johan')
    await user.click(screen.getByRole('button', { name: ct('subModal.save') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Johan', middleName: 'van der' }))
  })
})

/**
 * CONTACT-GESLACHT-1 — Danny asked for gender on the create form; it was left out because
 * the column did not exist. It does now, as `gender` carrying the candidate_genders VALUE
 * SLUG (male|female|other), validated server-side with exists:candidate_genders,value.
 * The options come from the tenant /genders lookup — never three hardcoded literals — so
 * these assert that the picker offers the LOOKUP labels and the payload carries the SLUG.
 */
describe('AddContactPersonModal · geslacht', () => {
  it('offers the tenant gender lookup and submits the SLUG, not the label', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Anna')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Bakker')

    await user.click(screen.getByRole('button', { name: ct('subModal.gender') }))
    // The seed lookup's human labels are what a recruiter picks from.
    await user.click(screen.getByRole('button', { name: 'Vrouw' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ gender: 'female' }))
  })

  it('leaves gender empty when it is not picked — the field is optional', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Anna')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Bakker')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ gender: '' }))
  })

  it('prefills the stored gender when an existing contact is edited', () => {
    render(<AddContactPersonModal onClose={() => {}} onCreate={vi.fn()} locations={locations} statuses={statuses}
      initial={contact({ gender: 'male' })} />)
    // The trigger shows the resolved LABEL for the stored slug.
    expect(screen.getByRole('button', { name: ct('subModal.gender') })).toHaveTextContent('Man')
  })
})

describe('AddContactPersonModal · import card (Danny 02-08: "+ nieuwe contactpersoon ... moeten ook een CSV-upload hebben")', () => {
  const csvFile = new File(['klant_naam,voornaam,achternaam\nZorggroep Middenland,Marieke,de Vries'], 'contacten.csv', { type: 'text/csv' })
  const xlsxFile = new File(['binary'], 'contacten.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const cleanResult: ImportRunResult = {
    entity: 'contacts', dry_run: true,
    summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
    unknown_columns: [],
    rows: [{ row: 1, action: 'create', reference: 'Zorggroep Middenland / Marieke de Vries', id: null, messages: [] }],
  }
  // Same shape, but the row resolved to a DIFFERENT real customer than the one open here.
  const mismatchResult: ImportRunResult = {
    ...cleanResult,
    rows: [{ row: 1, action: 'create', reference: 'Thuiszorg De Brug / Marieke de Vries', id: null, messages: [] }],
  }

  it('refuses an .xlsx file client-side with the save-as-CSV instruction, and never calls the dry run', () => {
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

    // COMPACT-IMPORT-1: the compact card has no dedicated dropzone element — the
    // whole card body accepts a drop, so its own intro line (a direct child of the
    // onDrop-bearing div) is the stable anchor to its parent.
    const dropZone = screen.getByText(ct('subModal.import.intro', { entity: st('import.entities.contacts.label') })).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [xlsxFile] } })

    expect(screen.getByText(st('import.wrongFileType'))).toBeInTheDocument()
    expect(dryRunImport).not.toHaveBeenCalled()
  })

  it('never reaches the real import before the mandatory dry run succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

    expect(screen.queryByRole('button', { name: st('import.preview.confirm') })).not.toBeInTheDocument()

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))

    expect(dryRunImport).toHaveBeenCalledTimes(1)
    expect(runImport).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: st('import.preview.confirm') })).toBeInTheDocument()
  })

  it('closes the modal and calls onImported once a real import lands something', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onImported = vi.fn()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    vi.mocked(runImport).mockResolvedValue({ ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'c-1' }] })

    render(<AddContactPersonModal onClose={onClose} onImported={onImported} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))
    await user.click(await screen.findByRole('button', { name: st('import.preview.confirm') }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(runImport).toHaveBeenCalledTimes(1)
  })

  it('gates the picker on customers.create: disabled, with the honest notice, not a button that would 403', () => {
    authState.hasPermission = (perm: string) => perm !== 'customers.create'
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

    expect(screen.getByLabelText(st('import.selectCsv'))).toBeDisabled()
    expect(screen.getByText(st('import.noImportPermission'))).toBeInTheDocument()
  })

  it('warns before the real import when a dry-run row resolves to a customer other than the one open here', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(mismatchResult)
    vi.mocked(runImport).mockResolvedValue({ ...mismatchResult, dry_run: false })
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))
    await screen.findByRole('button', { name: st('import.preview.confirm') })

    await user.click(screen.getByRole('button', { name: st('import.preview.confirm') }))
    expect(runImport).not.toHaveBeenCalled()
    expect(screen.getByText(ct('subModal.import.mismatchConfirm', { count: 1, names: 'Thuiszorg De Brug' }))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ct('subModal.import.mismatchProceed') }))
    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(1))
  })
})
