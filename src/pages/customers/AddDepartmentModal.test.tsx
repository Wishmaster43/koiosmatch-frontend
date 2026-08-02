/**
 * AddDepartmentModal — covers the house "wide form" adoption (Danny 27-07): the
 * card regroup (Algemeen/Zakelijk/Omschrijving) still submits the exact same
 * DepartmentPayload shape via `onCreate`, the location picker (bare <select>
 * before, now a searchable CreatableSelect, allowCreate={false}) actually filters
 * by typing, and the name/location-required validation still blocks an
 * incomplete submit.
 *
 * Danny 02-08 addition covered here: a CSV import card (mirrors AddLocationModal's
 * own — same shared wizard/card, same parent-mismatch safety net, entity="departments").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddDepartmentModal from './AddDepartmentModal'
// SUBENTITY-IMPORT-1: only the NETWORK calls are mocked — the real wizard/steps run,
// so these tests prove the actual wiring (dry-run-before-real-run, xlsx rejection,
// close-on-success, parent-mismatch), not a stub of it (mirrors AddLocationModal.test.tsx).
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/importeren/importApi'

vi.mock('@/pages/settings/sections/importeren/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/importeren/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})
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
// The location trigger's accessible name is now its field LABEL (aria-labelledby
// self-reference drops the button's own visible text), not the selected value —
// the label doubles as the picker's placeholder (same i18n key), "*" for required.
const locationTriggerName = () => `${ct('subModal.selectLocation')}*`

const locations = [{ id: 'loc-1', name: 'Locatie Noord' }, { id: 'loc-2', name: 'Locatie Zuid' }]
const statuses = [{ value: 'st-1', label: 'Actief' }]

beforeEach(() => {
  authState.hasPermission = () => true
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

describe('AddDepartmentModal', () => {
  it('blocks submit while the name is empty', async () => {
    const onCreate = vi.fn()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // A location is pre-selected (locations[0]) once locations exist, but the
    // required name is still blank — submit stays disabled.
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('blocks submit and flags both fields when created with no locations available', async () => {
    const onCreate = vi.fn()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={[]} statuses={statuses} />)

    // No locations: the picker renders the "create a location first" notice instead.
    expect(screen.getByText(ct('subModal.noLocationsFirst'))).toBeInTheDocument()
    const createBtn = screen.getByRole('button', { name: ct('subModal.create') })
    expect(createBtn).toBeDisabled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('the location picker is searchable — typing narrows the option list, then picking updates the trigger', async () => {
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // Location defaults to the first entry (locations[0]), but the trigger's name
    // is the field label now — find it by that, not the selected value.
    await user.click(screen.getByRole('button', { name: locationTriggerName() }))

    const search = screen.getByPlaceholderText(ct('subModal.selectLocation'))
    await user.type(search, 'Zuid')

    // Filtering to "Zuid" narrows the OPTION list to the one match — the trigger's
    // own name never included "Locatie Noord" to begin with, so absence is a clean check.
    expect(screen.getByRole('button', { name: 'Locatie Zuid' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Noord' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    // Trigger's name stays the field label; assert the pick via its rendered text.
    expect(screen.getByRole('button', { name: locationTriggerName() })).toHaveTextContent('Locatie Zuid')
  })

  it('submits the same DepartmentPayload shape via onCreate once required fields are filled', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} />)

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')

    // Switch the pre-selected location to prove the field still lands in the
    // payload after becoming a CreatableSelect.
    await user.click(screen.getByRole('button', { name: locationTriggerName() }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))

    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Thuiszorg', locationId: 'loc-2',
    }))
  })

  it('hides the location picker and skips its validation when lockLocationId is set', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<AddDepartmentModal onClose={() => {}} onCreate={onCreate} locations={locations} statuses={statuses} lockLocationId="loc-1" />)

    expect(screen.queryByText(ct('subModal.selectLocation'))).not.toBeInTheDocument()

    // { exact: false }: the required field's label carries a nested "*" span,
    // which breaks an exact text match (mirrors AddContactPersonModal.test.tsx).
    await user.type(screen.getByLabelText(ct('subModal.departmentName'), { exact: false }), 'Thuiszorg')
    await user.click(screen.getByRole('button', { name: ct('subModal.create') }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Thuiszorg', locationId: 'loc-1' }))
  })
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

  it('refuses an .xlsx file client-side with the save-as-CSV instruction, and never calls the dry run', () => {
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

    const dropZone = screen.getByText(st('import.dropHere')).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [xlsxFile] } })

    expect(screen.getByText(st('import.wrongFileType'))).toBeInTheDocument()
    expect(dryRunImport).not.toHaveBeenCalled()
  })

  it('never reaches the real import before the mandatory dry run succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

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

    expect(screen.getByLabelText(st('import.selectCsv'))).toBeDisabled()
    expect(screen.getByText(st('import.noImportPermission'))).toBeInTheDocument()
  })

  it('warns before the real import when a dry-run row resolves to a customer other than the one open here', async () => {
    const user = userEvent.setup()
    vi.mocked(dryRunImport).mockResolvedValue(mismatchResult)
    vi.mocked(runImport).mockResolvedValue({ ...mismatchResult, dry_run: false })
    render(<AddDepartmentModal onClose={() => {}} locations={locations} statuses={statuses} customerName="Zorggroep Middenland" />)

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
