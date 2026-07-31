/**
 * ImporterenSettings tests — replaces the mockup's zero API calls (verified: no
 * `api.`/`fetch(`/`axios` anywhere in the old file) with real request assertions
 * (§13: a mutation test must prove the REQUEST, never only that a callback fired).
 * Covers: the real multipart shape (field name MUST be "file") for both dry-run and
 * run, that a real import is NEVER offered before a successful preview, the
 * partial-result report (some rows error) rendering honestly instead of a bare
 * checkmark, the unknown-columns notice staying non-fatal, an .xlsx being rejected
 * with an actionable message (never silently dropped or accepted), and the
 * permission gate disabling (never hiding) the template download / upload areas.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import ImporterenSettings from './ImporterenSettings'
import { dryRunImport, runImport, downloadImportTemplate, fetchImportTemplates } from './importeren/importApi'

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

// The four REAL entities the backend's ImportRegistry serves (never the mockup's
// candidates/documents/vacancies/customers/shifts list).
const TEMPLATES = [
  { entity: 'customers', columns: ['naam'], example_rows: 2, url: '/imports/customers/template.csv' },
  { entity: 'locations', columns: ['klant_naam', 'naam'], example_rows: 2, url: '/imports/locations/template.csv' },
  { entity: 'departments', columns: ['klant_naam', 'locatie_naam', 'naam'], example_rows: 2, url: '/imports/departments/template.csv' },
  { entity: 'contacts', columns: ['klant_naam', 'locatie_naam', 'afdeling_naam', 'voornaam'], example_rows: 2, url: '/imports/contacts/template.csv' },
]

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

describe('ImporterenSettings — the wizard never claims success it did not earn', () => {
  it('lists the real four entities from the API, never the old mockup list', async () => {
    render(<ImporterenSettings />)
    for (const tpl of TEMPLATES) {
      expect(await screen.findByRole('button', { name: t(`import.entities.${tpl.entity}.label`) })).toBeInTheDocument()
    }
  })

  it('never offers the real import before a preview has run', async () => {
    render(<ImporterenSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })
    // The Confirm button only exists once a dry run has succeeded (PreviewStep).
    expect(screen.queryByRole('button', { name: t('import.preview.confirm') })).not.toBeInTheDocument()
  })

  it('runs the dry-run first, then reports a PARTIAL result honestly — never a bare checkmark', async () => {
    const user = userEvent.setup()
    render(<ImporterenSettings />)
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
    render(<ImporterenSettings />)
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

  it('rejects an .xlsx file with an actionable message and never calls the API', async () => {
    // applyAccept: false — the input's accept=".csv,.txt" already blocks an .xlsx pick
    // in a real OS file dialog, but drag-and-drop bypasses `accept` entirely, so the
    // component's OWN extension check (acceptFile in UploadStep) is what actually
    // guards that path. Disable user-event's accept-filtering to exercise that check
    // directly instead of relying on the (OS-dependent) native picker filter.
    const user = userEvent.setup({ applyAccept: false })
    render(<ImporterenSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const file = new File(['binary'], 'customers.xlsx', { type: 'application/vnd.ms-excel' })
    await user.upload(screen.getByLabelText(t('import.selectCsv')), file)

    expect(await screen.findByText(t('import.wrongFileType'))).toBeInTheDocument()
    expect(screen.queryByText(t('import.fileSelected', { name: 'customers.xlsx' }))).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('disables (never hides) the upload dropzone for a user without customers.create, but still allows the template download', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'customers.view' })
    render(<ImporterenSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    expect(screen.getByText(t('import.noImportPermission'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t('import.downloadTemplate') })).toBeEnabled()
    expect(screen.getByLabelText(t('import.selectCsv'))).toBeDisabled()
  })

  it('disables (never hides) the template download for a user without customers.view', async () => {
    mockUseAuth.mockReturnValue({ hasPermission: (perm: string) => perm === 'customers.create' })
    render(<ImporterenSettings />)
    await screen.findByRole('button', { name: t('import.downloadTemplate') })

    const downloadBtn = screen.getByRole('button', { name: t('import.downloadTemplate') })
    expect(downloadBtn).toBeDisabled()
    expect(downloadBtn).toHaveAttribute('title', t('import.noViewPermission'))
  })
})
