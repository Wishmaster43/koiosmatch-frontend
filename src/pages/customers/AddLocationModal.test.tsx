/**
 * AddLocationModal — covers the house "wide form" adoption (Danny 27-07): the
 * card regroup (Algemeen/Adres/Zakelijk/Contact) still submits the exact same
 * LocationPayload shape via `onCreate`, the status picker (bare <select> before,
 * now a searchable CreatableSelect, allowCreate={false}) actually filters by
 * typing, and the name-required validation still blocks an incomplete submit.
 *
 * Danny 02-08 additions covered here: (1) a CSV import card (mirrors
 * AddCustomerModal's own import card + its parent-mismatch safety net, new for
 * the per-entity importers which match an EXISTING customer by name); (2) the
 * province field became a searchable picker (was a bare TextField); (3) a rich-
 * text "Omschrijving" card; (4) "contact ter plaatse" became a real
 * pick-existing-or-type-new choice, coupled as the location's primary contact
 * once it exists (CONTACT-PRIMAIR-LOCATIE-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddLocationModal from './AddLocationModal'
import type { Location, Contact } from '@/types/customer'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — useImportWizard, UploadStep,
// PreviewStep and ResultStep all run for REAL, so these tests prove the actual wizard
// wiring (dry-run-before-real-run, xlsx rejection, close-on-success), not a stub of it.
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/importeren/importApi'
import { setLocationPrimaryContact } from './hooks/useCustomerContacts'
import { notifyError } from '@/lib/notify'

vi.mock('@/pages/settings/sections/importeren/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/importeren/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})
// Province cascade — mirrors AddCustomerModal.test.tsx's own province mock.
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Utrecht', 'Zuid-Holland'] }) }))
// CONTACT-PRIMAIR-LOCATIE-1: the coupling call is the only thing this file imports
// from useCustomerContacts — mocked so a test can assert it fired (or didn't) without
// hitting the network; the rest of the module runs for real.
vi.mock('./hooks/useCustomerContacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks/useCustomerContacts')>()
  return { ...actual, setLocationPrimaryContact: vi.fn() }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notify: vi.fn() }))
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors the house convention (DescriptionTab.test.tsx / candidate ProfileTab.test.tsx).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
// hasPermission defaults to "allow everything" so the pre-existing tests above (none of
// which touch the import card) keep behaving as before; the import describe block below
// overrides it per test to exercise the gate itself.
const { authState } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock allows every permission; the param exists only to match hasPermission's real signature
  authState: { hasPermission: ((_perm: string) => true) as (perm: string) => boolean },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: authState.hasPermission }) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The reused import-wizard steps (PreviewStep/ResultStep) are in the 'settings' bundle.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const statuses = [{ value: 'st-1', label: 'Actief' }, { value: 'st-2', label: 'Inactief' }]
const contact = (overrides: Partial<Contact>): Contact => ({
  id: 'c-1', helloflexLink: null, shiftmanagerLink: null, firstName: 'Joost', middleName: '', lastName: 'de Boer', name: 'Joost de Boer',
  customerId: 'cust-1', gender: '', role: '', email: '', phone: '', mobile: '', isPrimary: false,
  locationId: null, locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '', customFields: {},
  lastContactAt: null, lastContactType: null,
  ...overrides,
})

beforeEach(() => {
  authState.hasPermission = () => true
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
  vi.mocked(notifyError).mockReset()
  vi.mocked(setLocationPrimaryContact).mockReset()
})

describe('AddLocationModal', () => {
  it('blocks submit while the name is empty and shows the required message', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()

    await user.click(createBtn)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the status picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    // Status starts on its placeholder (no default picked) — open it via the trigger.
    // Trigger's name is the field LABEL (aria-labelledby self-reference drops its
    // own visible text), not the empty-state placeholder text it used to expose.
    await user.click(screen.getByRole('button', { name: ct('subModal.status') }))

    const search = screen.getByPlaceholderText(ct('subModal.selectStatus'))
    await user.type(search, 'Inactief')

    expect(screen.getByRole('button', { name: 'Inactief' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actief' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: ct('subModal.status') })).toHaveTextContent('Inactief')
  })

  it('submits the same LocationPayload shape via onCreate once the name is filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.type(screen.getByLabelText(ct('subModal.city')), 'Utrecht')

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Hoofdlocatie', city: 'Utrecht', country: 'Nederland',
    }))
  })
})

describe('AddLocationModal · province picker (Danny 02-08: "provincie heeft geen zoekbare dropdown???")', () => {
  it('is a searchable dropdown, not a bare text field — typing narrows it, picking sends `state`', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')

    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.state')) }))
    const search = screen.getByPlaceholderText(ct('common:select'))
    await user.type(search, 'Zuid')
    expect(screen.getByRole('button', { name: 'Zuid-Holland' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Utrecht' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zuid-Holland' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    // Sends `state` (the legacy-but-still-accepted wire key) — see this file's report
    // for why the key was not renamed to `province`.
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ state: 'Zuid-Holland' }))
  })
})

describe('AddLocationModal · description (Danny 02-08: "bij locatie en afdeling moeten we ook een beschrijving hebben")', () => {
  it('renders a rich-text Omschrijving card and its value reaches onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} statuses={statuses} />)

    expect(screen.getByText(ct('subModal.description'))).toBeInTheDocument()
    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    fireEvent.change(screen.getByLabelText('rich-text-editor'), { target: { value: '<p>Grootste vestiging</p>' } })

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ description: '<p>Grootste vestiging</p>' }))
  })
})

describe('AddLocationModal · contact ter plaatse (Danny: "je typt Joost de Boer in en Joost weet er niets van")', () => {
  const existingContacts = [contact({ id: 'c-1', name: 'Joost de Boer' }), contact({ id: 'c-2', name: 'Marieke Jansen' })]

  it('picking an existing contact couples it as primary once the location is created', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    vi.mocked(setLocationPrimaryContact).mockResolvedValue(true)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    await user.click(await screen.findByRole('button', { name: 'Joost de Boer' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // The free-text column still carries the resolved name (unchanged column)…
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ contactName: 'Joost de Boer' })))
    // …AND the real coupling fires against the just-created location's id.
    await waitFor(() => expect(setLocationPrimaryContact).toHaveBeenCalledWith('cust-1', 'c-1', 'loc-99'))
  })

  it('typing a brand-new name still works — no coupling is attempted for a name that matches nobody', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    const user = userEvent.setup()
    render(<AddLocationModal onClose={() => {}} onCreate={onCreate} customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    const search = screen.getByPlaceholderText(ct('subModal.contactName'))
    await user.type(search, 'Piet Nieuwkomer')
    await user.click(screen.getByRole('button', { name: /Piet Nieuwkomer/ }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ contactName: 'Piet Nieuwkomer' })))
    expect(setLocationPrimaryContact).not.toHaveBeenCalled()
  })

  it('reports a failed coupling honestly instead of pretending it worked — the location stays created', async () => {
    const onClose = vi.fn()
    const onCreate = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' } as unknown as Location)
    vi.mocked(setLocationPrimaryContact).mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<AddLocationModal onClose={onClose} onCreate={onCreate} customerId="cust-1" statuses={statuses} existingContacts={existingContacts} />)

    await user.type(screen.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(screen.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    await user.click(await screen.findByRole('button', { name: 'Joost de Boer' }))
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    // The location was created and the modal still closes — a coupling failure never
    // rolls back a location that may already hold other data (see this file's report).
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    // But the failure is surfaced, never silently swallowed as a bare success.
    expect(notifyError).toHaveBeenCalledWith(ct('subModal.contactCouplingFailed', { name: 'Hoofdlocatie' }))
  })
})

describe('AddLocationModal · import card (Danny 02-08: "+ nieuwe locatie ... moeten ook een CSV-upload hebben")', () => {
  const csvFile = new File(['klant_naam,naam\nZorggroep Middenland,Locatie Noord'], 'locaties.csv', { type: 'text/csv' })
  const xlsxFile = new File(['binary'], 'locaties.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  // A dry run that would land one row, resolved against the SAME customer as the
  // modal is scoped to — the clean, no-mismatch case.
  const cleanResult: ImportRunResult = {
    entity: 'locations', dry_run: true,
    summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
    unknown_columns: [],
    rows: [{ row: 1, action: 'create', reference: 'Zorggroep Middenland / Locatie Noord', id: null, messages: [] }],
  }
  // Same shape, but the row resolved to a DIFFERENT real customer than the one open here.
  const mismatchResult: ImportRunResult = {
    ...cleanResult,
    rows: [{ row: 1, action: 'create', reference: 'Thuiszorg De Brug / Locatie Noord', id: null, messages: [] }],
  }

  it('refuses an .xlsx file client-side with the save-as-CSV instruction, and never calls the dry run', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)

    // The dropzone's own recognisable content — a direct child of the actual
    // onDrop-bearing div, unlike the intro/order-hint text which sits in a
    // separate sibling block in this card's layout.
    const dropZone = screen.getByText(st('import.dropHere')).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [xlsxFile] } })

    expect(screen.getByText(st('import.wrongFileType'))).toBeInTheDocument()
    expect(dryRunImport).not.toHaveBeenCalled()
  })

  it('never reaches the real import before the mandatory dry run succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)

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
    vi.mocked(runImport).mockResolvedValue({ ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'loc-1' }] })

    render(<AddLocationModal onClose={onClose} onImported={onImported} statuses={statuses} customerName="Zorggroep Middenland" />)

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
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)

    expect(screen.getByLabelText(st('import.selectCsv'))).toBeDisabled()
    expect(screen.getByText(st('import.noImportPermission'))).toBeInTheDocument()
  })

  it('THE CRITICAL CARE CASE: warns before the real import when a dry-run row resolves to a customer other than the one open here', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(mismatchResult)
    vi.mocked(runImport).mockResolvedValue({ ...mismatchResult, dry_run: false })
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))
    await screen.findByRole('button', { name: st('import.preview.confirm') })

    // Clicking the plain Confirm button must NOT fire the real import yet — a
    // parent mismatch intercepts it with an explicit acknowledgement dialog first.
    await user.click(screen.getByRole('button', { name: st('import.preview.confirm') }))
    expect(runImport).not.toHaveBeenCalled()
    expect(screen.getByText(ct('subModal.import.mismatchConfirm', { count: 1, names: 'Thuiszorg De Brug' }))).toBeInTheDocument()

    // Only the explicit "proceed anyway" button in that dialog fires the real run.
    await user.click(screen.getByRole('button', { name: ct('subModal.import.mismatchProceed') }))
    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(1))
  })

  it('does NOT warn when every resolved row matches the customer this modal is scoped to', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    vi.mocked(runImport).mockResolvedValue({ ...cleanResult, dry_run: false })
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))
    await user.click(await screen.findByRole('button', { name: st('import.preview.confirm') }))

    // No acknowledgement dialog stands between a clean preview and the real run.
    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(1))
  })
})
