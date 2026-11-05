/** AddContactPersonModal · e-mail validation, status picker, name parts, gender, role, link and LinkedIn fields (split from AddContactPersonModal.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContactPayload } from './hooks/useCustomerContacts'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddContactPersonModal from './AddContactPersonModal'
import type { Contact, Department } from '@/types/customer'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — the real wizard/steps run,
// so these tests prove the actual wiring (dry-run-before-real-run, xlsx rejection,
// close-on-success, parent-mismatch), not a stub of it (mirrors AddLocationModal.test.tsx).
import { dryRunImport, runImport } from '@/pages/settings/sections/import/importApi'

// Both hooks fired by useContactFunctions (contact-functions + tenant settings)
// hit the module-scope cached-lookup path — a harmless empty response keeps
// each hook on its own seed fallback, same as before this change.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})
// hasPermission defaults to "allow everything" so the pre-existing tests above (none of
// which touch the import card) keep behaving as before; the import describe block below
// overrides it per test to exercise the gate itself.
const { authState, settingsState } = vi.hoisted(() => ({
  authState: { hasPermission: (() => true) as (perm: string) => boolean },
  // STATUS-HIDDEN-1: the settings blob a test can flip per-case (e.g. tenant marks
  // status_id required) — defaults to empty (nothing required).
  settingsState: { settings: {} as Record<string, unknown> },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: authState.hasPermission }) }))
// B1: per-test required custom field defs for the host under test (empty by default).
const { customFieldsState } = vi.hoisted(() => ({ customFieldsState: { fields: [] as unknown[] } }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn() }) }))
// Keep the REAL getJsonSetting (the component parses the required-fields config
// through it); only the settings blob itself is test-controlled.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => settingsState.settings }
})

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The reused import-wizard steps (PreviewStep/ResultStep) are in the 'settings' bundle.

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
  contacts: [], costCenter: '', billingEmail: '', statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {}, inUse: false,
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


// VALIDATIE-LIVE-1-rest (2026-08-08): email is the one contact field the backend
// validates with a shape rule (CustomerContactController::validateContact `email`
// => Laravel's `email` rule) — a malformed value now shows a live, on-blur inline
// error and blocks submit instead of only bouncing back as a 422.
describe('AddContactPersonModal · live e-mail format validation (VALIDATIE-LIVE-1-rest)', () => {
  it('shows an inline error under e-mail once blurred with a malformed value, and disables Create', async () => {
    const onCreate = vi.fn<(v: ContactPayload) => unknown>()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    const emailField = screen.getByLabelText(ct('subModal.email'), { exact: false })
    await user.type(emailField, 'not-an-email')
    fireEvent.focusOut(emailField)

    expect(await screen.findByText(ct('validation.emailFormat'))).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('a well-formed e-mail never blocks submit, and phone/mobile stay free of a live format gate (no backend shape rule for them)', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    const emailField = screen.getByLabelText(ct('subModal.email'), { exact: false })
    await user.type(emailField, 'jan@klant.nl')
    fireEvent.focusOut(emailField)
    // Free text in phone (the backend never restricts its shape here, unlike the
    // candidate form) must never gain a live "format" error of its own.
    const phoneField = screen.getByLabelText(ct('subModal.phone'), { exact: false })
    await user.type(phoneField, 'bel maar even')
    fireEvent.focusOut(phoneField)
    expect(screen.queryByText(ct('validation.emailFormat'))).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
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
    const onCreate = vi.fn<(v: ContactPayload) => unknown>()
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
    const onCreate = vi.fn<(v: ContactPayload) => unknown>()
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

  // CLEAR-SWEEP (Danny 13-08): gender is optional (useCustomerContacts.toApi
  // coerces '' to null) — a picked value must be clearable back to nothing.
  it('CLEAR-SWEEP: pick then clear the gender picker', async () => {
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={vi.fn()} locations={locations} statuses={statuses} />)

    await user.click(screen.getByRole('button', { name: ct('subModal.gender') }))
    await user.click(screen.getByRole('button', { name: 'Vrouw' }))
    expect(screen.getByRole('button', { name: ct('subModal.gender') })).toHaveTextContent('Vrouw')

    const clear = screen.getByTitle(i18n.t('clearField', { ns: 'common', field: ct('subModal.gender') }))
    await user.click(clear)
    expect(screen.getByRole('button', { name: ct('subModal.gender') })).toHaveTextContent(ct('subModal.noneOption'))
  })
})

describe('AddContactPersonModal · functie (role) is clearable', () => {
  // CLEAR-SWEEP (Danny 13-08): role is optional (useCustomerContacts.toApi sends
  // `function` through as-is, nullable column) — clearing must reach the payload.
  it('pick then clear the role picker', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Anna')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Bakker')
    await user.click(screen.getByRole('button', { name: ct('subModal.role') }))
    // Pick from the seed fallback list (DEFAULT_CONTACT_FUNCTIONS) rather than
    // typing a new one — the tenant's own free-entry flag is not under test here.
    await user.click(screen.getByRole('button', { name: 'Teamleider' }))
    expect(screen.getByRole('button', { name: ct('subModal.role') })).toHaveTextContent('Teamleider')

    const clear = screen.getByTitle(i18n.t('clearField', { ns: 'common', field: ct('subModal.role') }))
    await user.click(clear)
    expect(screen.getByRole('button', { name: ct('subModal.role') })).toHaveTextContent(ct('common:select'))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ role: '' }))
  })
})

describe('AddContactPersonModal · locatie/afdeling koppeling is clearable', () => {
  // CLEAR-SWEEP (Danny 13-08): both are optional relational ids — useCustomerContacts.
  // toApi already coerces an empty id to null, so clearing must reach the payload too.
  it('pick then clear the location picker', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectLocation') })).toHaveTextContent('Locatie Noord')

    const clear = screen.getByTitle(i18n.t('clearField', { ns: 'common', field: ct('subModal.selectLocation') }))
    await user.click(clear)
    expect(screen.getByRole('button', { name: ct('subModal.selectLocation') })).toHaveTextContent(ct('subModal.noneOption'))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ locationId: null }))
  })

  it('pick then clear the department picker', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} departments={departments} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    await user.click(screen.getByRole('button', { name: ct('subModal.selectLocation') }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.selectDepartment') }))
    await user.click(screen.getByRole('button', { name: 'Verpleging' }))
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent('Verpleging')

    const clear = screen.getByTitle(i18n.t('clearField', { ns: 'common', field: ct('subModal.selectDepartment') }))
    await user.click(clear)
    expect(screen.getByRole('button', { name: ct('subModal.selectDepartment') })).toHaveTextContent(ct('subModal.noneOption'))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ departmentId: null }))
  })
})

/**
 * CONTACT-LINKEDIN-1 (Danny 05-08) — the field submits verbatim in the create
 * payload; the URL-to-slug stripping happens once at the save boundary
 * (useCustomerContacts' toApi, covered by its own hook test), not in this form.
 */
describe('AddContactPersonModal · LinkedIn (CONTACT-LINKEDIN-1)', () => {
  it('sends the typed LinkedIn value with the create payload', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn<(v: ContactPayload) => unknown>()
    render(<AddContactPersonModal onCreate={onCreate} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.type(screen.getByLabelText(ct('subModal.linkedin'), { exact: false }), 'jan-jansen-123')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ linkedin: 'jan-jansen-123' }))
  })

  it('leaves LinkedIn empty when it is not filled in — the field is optional', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn<(v: ContactPayload) => unknown>()
    render(<AddContactPersonModal onCreate={onCreate} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ linkedin: '' }))
  })

  it('prefills the stored LinkedIn slug when an existing contact is edited', () => {
    render(<AddContactPersonModal onClose={() => {}} onCreate={vi.fn()} locations={locations} statuses={statuses}
      initial={contact({ linkedin: 'jan-jansen-123' })} />)
    expect(screen.getByLabelText(ct('subModal.linkedin'), { exact: false })).toHaveValue('jan-jansen-123')
  })
})
