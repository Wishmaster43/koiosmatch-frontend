/** AddContactPersonModal · CSV import card, double-submit, 422 mapping and required custom fields (split from AddContactPersonModal.test.tsx; resolves copy through the active locale's own i18n). */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { ContactPayload } from './hooks/useCustomerContacts'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddContactPersonModal from './AddContactPersonModal'
import { formKeyForApiField } from './useAddContactPersonForm'
import type { Contact } from '@/types/customer'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — the real wizard/steps run,
// so these tests prove the actual wiring (dry-run-before-real-run, xlsx rejection,
// close-on-success, parent-mismatch), not a stub of it (mirrors AddLocationModal.test.tsx).
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/import/importApi'

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
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const common = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

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
  // COLLAPSED-CARD-1 (03-08 A+D): the import card now lives behind a CollapsedCard
  // whose accessible button name is exactly this title text — every test below that
  // touches the card's contents must open it first.
  const importCardTitle = ct('subModal.import.title', { entity: st('import.entities.contacts.label') })

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', () => {
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))
    const input = screen.getByLabelText(st('import.selectCsv')) as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('accepts an .xlsx file dropped in — this card only forwards the raw File, never parses it client-side', () => {
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    // COMPACT-IMPORT-1: the compact card has no dedicated dropzone element — the
    // whole card body accepts a drop, so its own intro line (a direct child of the
    // onDrop-bearing div) is the stable anchor to its parent.
    const dropZone = screen.getByText(ct('subModal.import.intro', { entity: st('import.entities.contacts.label') })).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [xlsxFile] } })

    expect(screen.queryByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).not.toBeInTheDocument()
    expect(screen.getByText(st('import.fileSelected', { name: 'contacten.xlsx' }))).toBeInTheDocument()
  })

  it('refuses a genuinely unsupported file type client-side, and never calls the dry run', () => {
    const pdfFile = new File(['binary'], 'contacten.pdf', { type: 'application/pdf' })
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    const dropZone = screen.getByText(ct('subModal.import.intro', { entity: st('import.entities.contacts.label') })).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [pdfFile] } })

    // The refusal speaks the shared upload policy (a type refusal lists the allowed extensions).
    expect(screen.getByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).toBeInTheDocument()
    expect(dryRunImport).not.toHaveBeenCalled()
  })

  it('never reaches the real import before the mandatory dry run succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    await user.click(screen.getByRole('button', { name: importCardTitle }))

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
    await user.click(screen.getByRole('button', { name: importCardTitle }))

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
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    expect(screen.getByLabelText(st('import.selectCsv'))).toBeDisabled()
    expect(screen.getByText(st('import.noImportPermission'))).toBeInTheDocument()
  })

  it('warns before the real import when a dry-run row resolves to a customer other than the one open here', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(mismatchResult)
    vi.mocked(runImport).mockResolvedValue({ ...mismatchResult, dry_run: false })
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    await user.click(screen.getByRole('button', { name: importCardTitle }))

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

  // COLLAPSED-CARD-1 (03-08 A+D): proves the card is genuinely collapsed by
  // default — its contents are absent from the DOM until opened.
  it('the import card starts collapsed', () => {
    render(<AddContactPersonModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    expect(screen.queryByLabelText(st('import.selectCsv'))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: importCardTitle })).toHaveAttribute('aria-expanded', 'false')
  })
})

// ONIX N-007 (FE correctness): a double-click on "Aanmaken" created the contact twice
// (measured by the auditor: two identical "AUDIT DoubleSubmit" contacts).
describe('AddContactPersonModal · one create per click (ONIX N-007)', () => {
  it('ignores the second click while the first create is still running, then closes once', async () => {
    let resolve!: () => void
    const onCreate = vi.fn(() => new Promise<void>(r => { resolve = r }))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={onClose} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    const create = screen.getByRole('button', { name: ct('subModal.create') })
    fireEvent.click(create)
    fireEvent.click(create)
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: `${ct('subModal.create')}…` })).toBeDisabled()

    resolve()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})

// ONIX N-005: a 422 bag key no field renders (a required tenant custom field) must
// not fail silently — it lands in the create banner alongside any mapped field errors.
describe('AddContactPersonModal · unmapped 422 key (ONIX N-005)', () => {
  it('shows the banner for a dotted 422 key no field maps to, and sets no visible field flag for it', async () => {
    const err = {
      response: { data: { errors: { 'custom_fields.vog': ['The custom_fields.vog field is required.'] } } },
    }
    const onCreate = vi.fn().mockRejectedValue(err)
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(await screen.findByText(common('validation.fieldRequiredNamed', { field: 'vog' }))).toBeInTheDocument()
  })
})

// ONIX N-001: the BE's duplicate-contact 422 reads as a sentence, never the raw key.
describe('AddContactPersonModal · duplicate-contact 422 (N-001)', () => {
  const reject422 = (withId: boolean) => {
    const errors: Record<string, string[]> = { email: ['contacts.duplicate.email'] }
    if (withId) errors.duplicate_contact_id = ['c-other']
    return vi.fn().mockRejectedValue({ response: { status: 422, data: { errors } } })
  }
  const submitDup = async (onCreate: Mock<(v: ContactPayload) => unknown>, existing: Contact[]) => {
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} existing={existing} />)
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
  }

  it('names the existing contact when its id is among the loaded contacts', async () => {
    await submitDup(reject422(true), [contact({ id: 'c-other', name: 'Anna Bakker' })])
    expect(await screen.findByText(ct('subModal.duplicate.email', { name: 'Anna Bakker' }))).toBeInTheDocument()
    expect(screen.queryByText('contacts.duplicate.email')).not.toBeInTheDocument()
    expect(screen.queryByText('c-other')).not.toBeInTheDocument()
  })

  it('falls back to the nameless sentence when the id is not loaded', async () => {
    await submitDup(reject422(true), [])
    expect(await screen.findByText(ct('subModal.duplicate.emailNameless'))).toBeInTheDocument()
    expect(screen.queryByText('contacts.duplicate.email')).not.toBeInTheDocument()
  })
})

// Maps backend 422 field keys to the form's own field keys.
describe('formKeyForApiField', () => {
  it('maps renamed fields, keeps identical ones and passes unknown keys through', () => {
    expect(formKeyForApiField('linkedin_slug')).toBe('linkedin')
    expect(formKeyForApiField('first_name')).toBe('firstName')
    expect(formKeyForApiField('email')).toBe('email')
    expect(formKeyForApiField('unknown_x')).toBe('unknown_x')
  })
})

// B1 (#79): an untouched REQUIRED boolean custom field is an answer (false) — it must not block, and the payload carries it.
describe('AddContactPersonModal · required boolean custom field', () => {
  it('submits customFields { gdpr: false } when the checkbox is left untouched', async () => {
    customFieldsState.fields = [{ key: 'gdpr', label: 'GDPR', type: 'boolean', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }]
    const onCreate = vi.fn<(v: ContactPayload) => unknown>()
    const user = userEvent.setup()
    render(<AddContactPersonModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)
    await user.type(screen.getByLabelText(ct('subModal.firstName'), { exact: false }), 'Jan')
    await user.type(screen.getByLabelText(ct('subModal.lastName'), { exact: false }), 'Jansen')
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).not.toBeDisabled()
    await user.click(createBtn)
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0][0].customFields).toEqual({ gdpr: false })
    customFieldsState.fields = []
  })
})
