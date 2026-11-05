/** AddDepartmentModal · import card (split from AddDepartmentModal.test.tsx; mocks duplicated because hoisted vi.mock blocks cannot be shared). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddDepartmentModal from './AddDepartmentModal'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — the real wizard/steps run,
// so these tests prove the actual wiring (dry-run-before-real-run, xlsx rejection,
// close-on-success, parent-mismatch), not a stub of it (mirrors AddLocationModal.test.tsx).
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})
// Tiptap needs a real browser to mount — stubbed with a plain controlled textarea,
// mirrors the house convention (AddLocationModal.test.tsx / MatchModal.test.tsx).
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))
// hasPermission defaults to "allow everything" (the non-import suites in the sibling files rely
// on that); the import describe block below overrides it per test to exercise the gate itself.
const { authState, settingsState } = vi.hoisted(() => ({
  authState: { hasPermission: (() => true) as (perm: string) => boolean },
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
// ONIX N-005: one required def ('vog') for the required-custom-field describe in
// AddDepartmentModal.createGuards.test.tsx; every describe in this file renders no field for it (fields: []).
const { customFieldsState } = vi.hoisted(() => ({ customFieldsState: { fields: [] as unknown[] } }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn() }) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
// The reused import-wizard steps (PreviewStep/ResultStep) are in the 'settings' bundle.
const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  settingsState.settings = {}
  customFieldsState.fields = []
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

describe('AddDepartmentModal · import card (Danny 02-08: "+ nieuwe afdeling ... moeten ook een CSV-upload hebben")', () => {
  const csvFile = new File(['klant_naam,locatie_naam,naam\nZorggroep Middenland,Locatie Noord,Somatiek'], 'afdelingen.csv', { type: 'text/csv' })
  const xlsxFile = new File(['binary'], 'afdelingen.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const cleanResult: ImportRunResult = {
    entity: 'departments', dry_run: true,
    summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
    unknown_columns: [],
    rows: [{ row: 1, action: 'create', reference: 'Zorggroep Middenland / Locatie Noord / Somatiek', id: null, messages: [] }],
  }
  // Same shape, but the row resolved to a DIFFERENT real customer than the one open here.
  const mismatchResult: ImportRunResult = {
    ...cleanResult,
    rows: [{ row: 1, action: 'create', reference: 'Thuiszorg De Brug / Locatie Noord / Somatiek', id: null, messages: [] }],
  }
  // COLLAPSED-CARD-1 (03-08 A+D): the import card now lives behind a CollapsedCard
  // whose accessible button name is exactly this title text — every test below that
  // touches the card's contents must open it first.
  const importCardTitle = ct('subModal.import.title', { entity: st('import.entities.departments.label') })

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))
    const input = screen.getByLabelText(st('import.selectCsv')) as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('accepts an .xlsx file dropped in — this card only forwards the raw File, never parses it client-side', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    // COMPACT-IMPORT-1: the compact card has no dedicated dropzone element — the
    // whole card body accepts a drop, so its own intro line (a direct child of the
    // onDrop-bearing div) is the stable anchor to its parent.
    const dropZone = screen.getByText(ct('subModal.import.intro', { entity: st('import.entities.departments.label') })).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [xlsxFile] } })

    expect(screen.queryByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).not.toBeInTheDocument()
    expect(screen.getByText(st('import.fileSelected', { name: 'afdelingen.xlsx' }))).toBeInTheDocument()
  })

  it('refuses a genuinely unsupported file type client-side, and never calls the dry run', () => {
    const pdfFile = new File(['binary'], 'afdelingen.pdf', { type: 'application/pdf' })
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    const dropZone = screen.getByText(ct('subModal.import.intro', { entity: st('import.entities.departments.label') })).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [pdfFile] } })

    // The refusal speaks the shared upload policy (a type refusal lists the allowed extensions).
    expect(screen.getByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).toBeInTheDocument()
    expect(dryRunImport).not.toHaveBeenCalled()
  })

  it('never reaches the real import before the mandatory dry run succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
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
    vi.mocked(runImport).mockResolvedValue({ ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'dep-1' }] })

    render(<AddDepartmentModal onClose={onClose} onImported={onImported} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
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
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    expect(screen.getByLabelText(st('import.selectCsv'))).toBeDisabled()
    expect(screen.getByText(st('import.noImportPermission'))).toBeInTheDocument()
  })

  it('warns before the real import when a dry-run row resolves to a customer other than the one open here', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(mismatchResult)
    vi.mocked(runImport).mockResolvedValue({ ...mismatchResult, dry_run: false })
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
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
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)
    expect(screen.queryByLabelText(st('import.selectCsv'))).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: importCardTitle })).toHaveAttribute('aria-expanded', 'false')
  })
})
