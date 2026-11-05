/** AddLocationModal · import card (split from AddLocationModal.test.tsx; resolves copy through the active locale's own i18n). */
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
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — useImportWizard, UploadStep,
// PreviewStep and ResultStep all run for REAL, so these tests prove the actual wizard
// wiring (dry-run-before-real-run, xlsx rejection, close-on-success), not a stub of it.
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/import/importApi'
import { setLocationPrimaryContact } from './hooks/useCustomerContacts'
import { notifyError } from '@/lib/notify'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
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
// K-283: useLocations is react-query-backed — mocked directly (mirrors
// AddCustomerModal.test.tsx's own branch-picker mock) so this test doesn't
// need a QueryClientProvider ancestor.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'br-1', label: 'Vestiging Noord' }, { value: 'br-2', label: 'Vestiging Zuid' }],
}))
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

const statuses = [{ value: 'st-1', label: 'Actief' }, { value: 'st-2', label: 'Inactief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
  vi.mocked(notifyError).mockReset()
  vi.mocked(setLocationPrimaryContact).mockReset()
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
  // COLLAPSED-CARD-1 (03-08 A+D): the import card now lives behind a CollapsedCard
  // whose accessible button name is exactly this title text — every test below that
  // touches the card's contents must open it first.
  const importCardTitle = ct('subModal.import.title', { entity: st('import.entities.locations.label') })

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))
    const input = screen.getByLabelText(st('import.selectCsv')) as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('accepts an .xlsx file dropped in — this card only forwards the raw File, never parses it client-side', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    // COMPACT-IMPORT-1: the compact card has no dedicated dropzone element — the
    // whole card body accepts a drop, so its own intro line (a direct child of the
    // onDrop-bearing div) is the stable anchor to its parent.
    const dropZone = screen.getByText(ct('subModal.import.intro', { entity: st('import.entities.locations.label') })).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [xlsxFile] } })

    expect(screen.queryByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).not.toBeInTheDocument()
    expect(screen.getByText(st('import.fileSelected', { name: 'locaties.xlsx' }))).toBeInTheDocument()
  })

  it('refuses a genuinely unsupported file type client-side, and never calls the dry run', () => {
    const pdfFile = new File(['binary'], 'locaties.pdf', { type: 'application/pdf' })
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    const dropZone = screen.getByText(ct('subModal.import.intro', { entity: st('import.entities.locations.label') })).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [pdfFile] } })

    // The refusal speaks the shared upload policy (a type refusal lists the allowed extensions).
    expect(screen.getByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).toBeInTheDocument()
    expect(dryRunImport).not.toHaveBeenCalled()
  })

  it('never reaches the real import before the mandatory dry run succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)
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
    vi.mocked(runImport).mockResolvedValue({ ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'loc-1' }] })

    render(<AddLocationModal onClose={onClose} onImported={onImported} statuses={statuses} customerName="Zorggroep Middenland" />)
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
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    expect(screen.getByLabelText(st('import.selectCsv'))).toBeDisabled()
    expect(screen.getByText(st('import.noImportPermission'))).toBeInTheDocument()
  })

  it('THE CRITICAL CARE CASE: warns before the real import when a dry-run row resolves to a customer other than the one open here', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(mismatchResult)
    vi.mocked(runImport).mockResolvedValue({ ...mismatchResult, dry_run: false })
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)
    await user.click(screen.getByRole('button', { name: importCardTitle }))

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
    await user.click(screen.getByRole('button', { name: importCardTitle }))

    const input = screen.getByLabelText(st('import.selectCsv'))
    await user.upload(input, csvFile)
    await user.click(screen.getByRole('button', { name: st('import.runPreview') }))
    await user.click(await screen.findByRole('button', { name: st('import.preview.confirm') }))

    // No acknowledgement dialog stands between a clean preview and the real run.
    await waitFor(() => expect(runImport).toHaveBeenCalledTimes(1))
  })

  // COLLAPSED-CARD-1 (03-08 A+D): proves the card is genuinely collapsed by
  // default — its contents are absent from the DOM until opened.
  it('the import card starts collapsed', () => {
    render(<AddLocationModal onClose={() => {}} statuses={statuses} customerName="Zorggroep Middenland" />)
    expect(screen.queryByLabelText(st('import.selectCsv'))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: importCardTitle })).toHaveAttribute('aria-expanded', 'false')
  })
})
