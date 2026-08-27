/**
 * ImportSettings tests — replaces the mockup's zero API calls (verified: no
 * `api.`/`fetch(`/`axios` anywhere in the old file) with real request assertions
 * (§13: a mutation test must prove the REQUEST, never only that a callback fired).
 * Covers: the real multipart shape (field name MUST be "file") for both dry-run and
 * run, that a real import is NEVER offered before a successful preview, the
 * partial-result report (some rows error) rendering honestly instead of a bare
 * checkmark, the unknown-columns notice staying non-fatal, .xlsx being ACCEPTED
 * (this card only forwards the raw File — the backend's reader recognises it by
 * its ZIP magic) while a genuinely unsupported type is still rejected with an
 * actionable message, and the permission gate — disabling (never hiding) the
 * template download / upload areas, and following the SELECTED entity's own
 * permission pair (vacancies vs. the customer-tree entities), never a hardcoded
 * customers.* pair regardless of selection.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ImportSettings from './ImportSettings'
import { dryRunImport, runImport, downloadImportTemplate, fetchImportTemplates } from './import/importApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

type MockFn = ReturnType<typeof vi.fn>

// The four single-entity templates the backend's ImportRegistry serves (never the
// mockup's candidates/documents/vacancies/customers/shifts list).
const TEMPLATES = [
  { entity: 'customers', columns: ['naam'], example_rows: 2, url: '/imports/customers/template.csv' },
  { entity: 'locations', columns: ['klant_naam', 'naam'], example_rows: 2, url: '/imports/locations/template.csv' },
  { entity: 'departments', columns: ['klant_naam', 'locatie_naam', 'naam'], example_rows: 2, url: '/imports/departments/template.csv' },
  { entity: 'contacts', columns: ['klant_naam', 'locatie_naam', 'afdeling_naam', 'voornaam'], example_rows: 2, url: '/imports/contacts/template.csv' },
]

// IMPORT-TREE-1 — the COMBINED template, with the real column shape the backend
// hands out (ImportTemplateController::TEMPLATES['customer_tree']) and in the API's
// own position: LAST. The wizard has to recognise it from those columns.
const TREE_TEMPLATE = {
  entity: 'customer_tree',
  columns: ['klant_naam', 'klant_email', 'klant_kvk_nummer', 'klant_branche',
    'locatie_naam', 'locatie_postcode', 'afdeling_naam', 'voornaam', 'achternaam', 'email'],
  example_rows: 2,
  url: '/imports/customer_tree/template.csv',
}
const TEMPLATES_WITH_TREE = [...TEMPLATES, TREE_TEMPLATE]

// Resolve the whole templates list for one test (the shared beforeEach serves the
// four single-entity ones, so the existing flows keep exercising that path).
const serveTemplates = (list: unknown[]) => {
  ;(api.get as MockFn).mockResolvedValue({ data: { data: list } })
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  ;(api.get as MockFn).mockResolvedValue({ data: { data: TEMPLATES } })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('importApi (request shapes)', () => {
  const file = new File(['a;b\n1;2'], 'test.csv', { type: 'text/csv' })

  it('GETs /imports/templates', async () => {
    ;(api.get as MockFn).mockResolvedValueOnce({ data: { data: TEMPLATES } })
    await fetchImportTemplates()
    expect(api.get).toHaveBeenCalledWith('/imports/templates', { signal: undefined })
  })

  it('POSTs /imports/{entity}/dry-run with a multipart field named exactly "file"', async () => {
    ;(api.post as MockFn).mockResolvedValueOnce({
      data: { data: { entity: 'customers', dry_run: true, summary: { rows: 0, create: 0, update: 0, skip: 0, error: 0 }, unknown_columns: [], rows: [] } },
    })
    await dryRunImport('customers', file)
    expect(api.post).toHaveBeenCalledWith('/imports/customers/dry-run', expect.any(FormData))
    const form = (api.post as MockFn).mock.calls[0][1] as FormData
    expect(Array.from(form.keys())).toEqual(['file'])
    expect(form.get('file')).toBe(file)
  })

  it('POSTs /imports/{entity} (the real run) with the same "file" field, no /dry-run suffix', async () => {
    ;(api.post as MockFn).mockResolvedValueOnce({
      data: { data: { entity: 'customers', dry_run: false, summary: { rows: 0, create: 0, update: 0, skip: 0, error: 0 }, unknown_columns: [], rows: [] } },
    })
    await runImport('customers', file)
    expect(api.post).toHaveBeenCalledWith('/imports/customers', expect.any(FormData))
    const form = (api.post as MockFn).mock.calls[0][1] as FormData
    expect(Array.from(form.keys())).toEqual(['file'])
  })

  it('downloads the template as a blob GET, never a bare navigation', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    ;(api.get as MockFn).mockResolvedValueOnce({ data: new Blob(['a']), headers: {} })

    await downloadImportTemplate('locations')

    expect(api.get).toHaveBeenCalledWith('/imports/locations/template.csv', { responseType: 'blob' })
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

describe('ImportSettings — the wizard never claims success it did not earn', () => {
  it('lists the real four entities from the API, never the old mockup list', async () => {
    render(<ImportSettings />)
    for (const tpl of TEMPLATES) {
      expect(await screen.findByRole('button', { name: t(`import.entities.${tpl.entity}.label`) })).toBeInTheDocument()
    }
  })

  it('never offers the real import before a preview has run', async () => {
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })
    // The Confirm button only exists once a dry run has succeeded (PreviewStep).
    expect(screen.queryByRole('button', { name: t('import.preview.confirm') })).not.toBeInTheDocument()
  })

  it('runs the dry-run first, then reports a PARTIAL result honestly — never a bare checkmark', async () => {
    const user = userEvent.setup()
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['naam;email\nAcme;a@a.nl'], 'customers.csv', { type: 'text/csv' })
    const input = screen.getByLabelText(t('import.selectCsv')) as HTMLInputElement
    await user.upload(input, file)
    expect(await screen.findByText(t('import.fileSelected', { name: 'customers.csv' }))).toBeInTheDocument()

    const dryRunResult = {
      entity: 'customers', dry_run: true,
      summary: { rows: 3, create: 2, update: 0, skip: 0, error: 1 },
      unknown_columns: ['interne_notitie'],
      rows: [
        { row: 2, action: 'create', reference: 'Acme', id: null, messages: [] },
        { row: 3, action: 'create', reference: 'Beta', id: null, messages: [] },
        { row: 4, action: 'error', reference: null, id: null, messages: ['email: This field is required.'] },
      ],
    }
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: dryRunResult } })

    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))
    expect(api.post).toHaveBeenCalledWith('/imports/customers/dry-run', expect.any(FormData))

    // Preview shows the summary + the unknown-columns NOTICE (not an error) + the error row detail.
    expect(await screen.findByText(t('import.preview.title'))).toBeInTheDocument()
    expect(screen.getByText(t('import.unknownColumns.title'))).toBeInTheDocument()
    expect(screen.getByText('interne_notitie')).toBeInTheDocument()
    expect(screen.getByText('email: This field is required.')).toBeInTheDocument()

    // Confirm is enabled (create+update > 0) — clicking it fires the REAL POST, same
    // field name, no /dry-run suffix.
    const runResult = { ...dryRunResult, dry_run: false }
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: runResult } })
    const confirmBtn = screen.getByRole('button', { name: t('import.preview.confirm') })
    expect(confirmBtn).toBeEnabled()
    await user.click(confirmBtn)
    expect(api.post).toHaveBeenCalledWith('/imports/customers', expect.any(FormData))

    // Result step reports the partial outcome honestly — never a bare success message.
    expect(await screen.findByText(t('import.result.subtitlePartial', { errorCount: 1, total: 3 }))).toBeInTheDocument()
    expect(screen.queryByText(t('import.result.subtitleSuccess'))).not.toBeInTheDocument()
  })

  it('disables the Confirm button when the dry run found nothing to create or update', async () => {
    const user = userEvent.setup()
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['naam\nAcme'], 'customers.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(t('import.selectCsv')), file)

    const dryRunResult = {
      entity: 'customers', dry_run: true,
      summary: { rows: 1, create: 0, update: 0, skip: 0, error: 1 },
      unknown_columns: [],
      rows: [{ row: 2, action: 'error', reference: null, id: null, messages: ['naam: invalid.'] }],
    }
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: dryRunResult } })
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))

    expect(await screen.findByText(t('import.preview.nothingToImport'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('import.preview.confirm') })).toBeDisabled()
  })

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', async () => {
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })
    const input = screen.getByLabelText(t('import.selectCsv')) as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('accepts an .xlsx file — this card only forwards the raw File, never parses it client-side', async () => {
    const user = userEvent.setup()
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['binary'], 'customers.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    await user.upload(screen.getByLabelText(t('import.selectCsv')), file)

    expect(await screen.findByText(t('import.fileSelected', { name: 'customers.xlsx' }))).toBeInTheDocument()
    expect(screen.queryByText(t('import.wrongFileType'))).not.toBeInTheDocument()

    const dryRunResult = {
      entity: 'customers', dry_run: true,
      summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
      unknown_columns: [], rows: [{ row: 2, action: 'create', reference: 'Acme', id: null, messages: [] }],
    }
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: dryRunResult } })
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))

    // The FormData reaching the backend still carries the actual .xlsx file, unmodified.
    expect(api.post).toHaveBeenCalledWith('/imports/customers/dry-run', expect.any(FormData))
    const form = (api.post as MockFn).mock.calls[0][1] as FormData
    expect((form.get('file') as File).name).toBe('customers.xlsx')
  })

  it('rejects a genuinely unsupported file type with an actionable message and never calls the API', async () => {
    // applyAccept: false — the input's accept=".csv,.txt,.xlsx" already blocks a .pdf
    // pick in a real OS file dialog, but drag-and-drop bypasses `accept` entirely, so
    // the component's OWN extension check (acceptFile in UploadStep) is what actually
    // guards that path. Disable user-event's accept-filtering to exercise that check
    // directly instead of relying on the (OS-dependent) native picker filter.
    const user = userEvent.setup({ applyAccept: false })
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['binary'], 'customers.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(t('import.selectCsv')), file)

    expect(await screen.findByText(t('import.wrongFileType'))).toBeInTheDocument()
    expect(screen.queryByText(t('import.fileSelected', { name: 'customers.pdf' }))).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('disables (never hides) the upload dropzone for a user without customers.create, but still allows the template download', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'customers.view' })
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    expect(screen.getByText(t('import.noImportPermission'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('import.downloadTemplate') })).toBeEnabled()
    expect(screen.getByLabelText(t('import.selectCsv'))).toBeDisabled()
  })

  it('disables (never hides) the template download for a user without customers.view', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'customers.create' })
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const downloadBtn = screen.getByRole('button', { name: t('import.downloadTemplate') })
    expect(downloadBtn).toBeDisabled()
    expect(downloadBtn).toHaveAttribute('title', t('import.noViewPermission'))
  })
})

// IMPORT-PERM-ENTITY-1: the permission gate follows the SELECTED entity, not a
// hardcoded customers.* pair — mirrors routes/api/tenant/exports.php (K6c: vacancies
// carries its own vacancies.view/vacancies.create right, every other entity here is
// a customer-tree sub-entity sharing customers.view/customers.create).
describe('ImportSettings — the permission gate follows the SELECTED entity (IMPORT-PERM-ENTITY-1)', () => {
  const VACANCIES_TEMPLATE = { entity: 'vacancies', columns: ['titel'], example_rows: 2, url: '/imports/vacancies/template.csv' }
  const TEMPLATES_WITH_VACANCIES = [...TEMPLATES, VACANCIES_TEMPLATE]

  it('a user with vacancies.create but NOT customers.create can upload for the vacancies entity', async () => {
    serveTemplates(TEMPLATES_WITH_VACANCIES)
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'vacancies.view' || perm === 'vacancies.create' })
    const user = userEvent.setup()
    render(<ImportSettings />)

    await user.click(await screen.findByRole('button', { name: t('import.entities.vacancies.label', { defaultValue: 'vacancies' }) }))

    // No "no import permission" notice, upload input enabled, download enabled.
    expect(screen.queryByText(t('import.noImportPermission'))).not.toBeInTheDocument()
    expect(screen.getByLabelText(t('import.selectCsv'))).toBeEnabled()
    expect(screen.getByRole('button', { name: t('import.downloadTemplate') })).toBeEnabled()
  })

  it('that SAME user is correctly blocked once they switch to a customer-tree entity (customers)', async () => {
    serveTemplates(TEMPLATES_WITH_VACANCIES)
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'vacancies.view' || perm === 'vacancies.create' })
    render(<ImportSettings />)

    // Lands on the first template in display order — customers here — where the
    // user has neither customers.view nor customers.create.
    await screen.findByRole('button', { name: t('import.entities.customers.label') })
    expect(await screen.findByText(t('import.noImportPermission'))).toBeInTheDocument()
    expect(screen.getByLabelText(t('import.selectCsv'))).toBeDisabled()
  })
})

describe('the combined whole-customer file (IMPORT-TREE-1)', () => {
  it('surfaces the combined template from the API, first and in its own group, without hiding the four', async () => {
    serveTemplates(TEMPLATES_WITH_TREE)
    render(<ImportSettings />)

    // Both paths are offered, each under its own heading — never one hidden. The
    // label call mirrors the component's own (slug as defaultValue), so this holds
    // both before and after the locale lane ships the customer_tree label.
    const treeLabel = t('import.entities.customer_tree.label', { defaultValue: 'customer_tree' }) as string
    expect(await screen.findByRole('button', { name: treeLabel })).toBeInTheDocument()
    expect(screen.getByText(t('import.groups.wholeTree'))).toBeInTheDocument()
    expect(screen.getByText(t('import.groups.perEntity'))).toBeInTheDocument()
    for (const tpl of TEMPLATES) {
      expect(screen.getByRole('button', { name: t(`import.entities.${tpl.entity}.label`) })).toBeInTheDocument()
    }
  })

  it('lands on the combined file and explains it INSTEAD of the four-step order', async () => {
    serveTemplates(TEMPLATES_WITH_TREE)
    render(<ImportSettings />)

    // The tree explainer, including the sentence that stops someone doing both.
    expect(await screen.findByText(`${t('import.tree.title')}:`)).toBeInTheDocument()
    expect(screen.getByText(t('import.tree.replacesOrder'))).toBeInTheDocument()
    expect(screen.getByText(t('import.tree.allOrNothing'))).toBeInTheDocument()
    // The four-step order banner would be a lie here: this file needs no order.
    expect(screen.queryByText(`${t('import.order.title')}:`)).not.toBeInTheDocument()
  })

  it('keeps the ordering explanation for the four separate files and offers the combined one back', async () => {
    const user = userEvent.setup()
    serveTemplates(TEMPLATES_WITH_TREE)
    render(<ImportSettings />)

    await user.click(await screen.findByRole('button', { name: t('import.entities.locations.label') }))

    // The order banner is back, with its own per-entity hint.
    expect(screen.getByText(`${t('import.order.title')}:`)).toBeInTheDocument()
    expect(screen.getByText(t('import.order.locationsHint'))).toBeInTheDocument()
    expect(screen.queryByText(`${t('import.tree.title')}:`)).not.toBeInTheDocument()

    // …and it names the one-file alternative rather than leaving it to be discovered.
    await user.click(screen.getByRole('button', { name: t('import.order.switchToTree') }))
    expect(screen.getByText(`${t('import.tree.title')}:`)).toBeInTheDocument()
  })

  it('posts the combined file to its OWN dry-run route with the multipart field named "file"', async () => {
    const user = userEvent.setup()
    serveTemplates(TEMPLATES_WITH_TREE)
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['klant_naam;voornaam\nZorggroep;Marieke'], 'klant.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(t('import.selectCsv')), file)
    ;(api.post as MockFn).mockResolvedValueOnce({
      data: { data: { entity: 'customer_tree', dry_run: true, summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 }, unknown_columns: [], rows: [] } },
    })

    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))

    expect(api.post).toHaveBeenCalledWith('/imports/customer_tree/dry-run', expect.any(FormData))
    const form = (api.post as MockFn).mock.calls[0][1] as FormData
    expect(Array.from(form.keys())).toEqual(['file'])
    expect(form.get('file')).toBe(file)
  })

  it('never puts a green tick over a row that imported minus a field', async () => {
    const user = userEvent.setup()
    serveTemplates(TEMPLATES_WITH_TREE)
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['klant_naam\nZorggroep'], 'klant.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(t('import.selectCsv')), file)

    // The backend's own wording: the row WAS created, but its industry did not land
    // (CustomerTreeImporter::resolveCustomer) — zero error rows, one degraded row.
    const remark = "customer: klant_branche: 'Ouderenzorg' is not one of this bureau's industries — left empty."
    const runResult = {
      entity: 'customer_tree', dry_run: true,
      summary: { rows: 2, create: 2, update: 0, skip: 0, error: 0 },
      unknown_columns: [],
      rows: [
        { row: 2, action: 'create', reference: 'Zorggroep / Locatie Noord / Somatiek / Marieke de Vries', id: null, messages: [remark] },
        { row: 3, action: 'create', reference: 'Zorggroep / Locatie Zuid', id: null, messages: [] },
      ],
    }
    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: runResult } })
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))

    // Visible in the DEFAULT view — not hidden behind "show all rows".
    const partly = `${t('import.rows.remark')} ${remark}`
    expect(await screen.findByText(partly)).toBeInTheDocument()
    expect(screen.getByText(`${t('import.stats.remarks')}: 1`)).toBeInTheDocument()

    ;(api.post as MockFn).mockResolvedValueOnce({ data: { data: { ...runResult, dry_run: false } } })
    await user.click(screen.getByRole('button', { name: t('import.preview.confirm') }))

    // The real result must NOT claim everything landed — one row lost a field.
    expect(await screen.findByText(t('import.result.subtitleSuccessWithRemarks', { count: 1 }))).toBeInTheDocument()
    expect(screen.queryByText(t('import.result.subtitleSuccess'))).not.toBeInTheDocument()
    expect(screen.getByText(partly)).toBeInTheDocument()
  })

  it('tells the user the counts are ROWS, since one row builds up to four records', async () => {
    const user = userEvent.setup()
    serveTemplates(TEMPLATES_WITH_TREE)
    render(<ImportSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['klant_naam\nZorggroep'], 'klant.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(t('import.selectCsv')), file)
    ;(api.post as MockFn).mockResolvedValueOnce({
      data: { data: { entity: 'customer_tree', dry_run: true, summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 }, unknown_columns: [], rows: [{ row: 2, action: 'create', reference: 'Zorggroep', id: null, messages: [] }] } },
    })
    await user.click(screen.getByRole('button', { name: t('import.runPreview') }))

    expect(await screen.findByText(t('import.stats.rowsAreRowsTree'))).toBeInTheDocument()
    expect(screen.queryByText(t('import.stats.rowsAreRows'))).not.toBeInTheDocument()
  })
})
