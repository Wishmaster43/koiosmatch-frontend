/** AddCustomerModal · import card (split from AddCustomerModal.test.tsx; resolves copy through the active locale's own i18n). */
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
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AddCustomerModal from './AddCustomerModal'
// CUSTOMER-IMPORT-1: only the NETWORK calls are mocked — useImportWizard, UploadStep,
// PreviewStep and ResultStep all run for REAL, so these tests prove the actual wizard
// wiring (dry-run-before-real-run, xlsx rejection, close-on-success), not a stub of it.
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'], industryOptions: ['Zorg', 'IT'].map(n => ({ value: n, label: n })) }) }))
// CUST-SOURCE-FE-1: the acquisition-source picker, same shape as industry above.
vi.mock('@/lib/useCustomerSources', () => ({
  useCustomerSources: () => ({
    sources: ['LinkedIn', 'Google'].map(n => ({ value: n, label: n })), allowFreeEntry: false, invalidate: vi.fn(),
  }),
}))
// useLocations is react-query-backed (@tanstack/react-query) — mocked directly
// so this test doesn't need a QueryClientProvider ancestor.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'loc-1', label: 'Vestiging Noord' }, { value: 'loc-2', label: 'Vestiging Zuid' }],
}))
// KLANT-FASE-1: TENANT-RENAMED phases — the is_default row is NOT first and is NOT
// called 'prospect', so a slug/index-based default would pick the wrong one.
vi.mock('@/lib/useCustomerPhases', async () => {
  const { customerPhases, phaseFallbackColor } = await import('./AddCustomerModal.testKit')
  return {
    useCustomerPhases: () => ({
      phases: customerPhases,
      phaseMeta: (v?: string | null) => ({ value: v ?? '', label: v ?? '', color: phaseFallbackColor, isCustomer: false, isDefault: false }),
      defaultPhase: 'interesse',
      isCustomerPhase: (v?: string | null) => v === 'vaste_klant',
      loading: false,
    }),
  }
})
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
    hasPermission: (() => true) as (perm: string) => boolean,
  },
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authState.user, hasPermission: authState.hasPermission }) }))

// CUST-DUP-FE-1 (22-08): the duplicate probe + restore hooks talk to the real axios
// client — mock the seam so these tests can assert the REQUEST, not just a callback
// (mirrors AddCandidateModal.test.tsx's own getMock/postMock).
const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { get: getMock, post: postMock } }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
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
  getMock.mockReset()
  postMock.mockReset()
  // Benign GET default — the duplicate probe itself always POSTs (asserted below);
  // any incidental GET the modal fires resolves harmlessly to "no match".
  getMock.mockResolvedValue({ data: { exists: false, match: null } })
  postMock.mockResolvedValue({ data: {} })
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

    expect(screen.queryByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).not.toBeInTheDocument()
    expect(screen.getByText(st('import.fileSelected', { name: 'acme.xlsx' }))).toBeInTheDocument()
  })

  it('refuses a genuinely unsupported file type client-side, and never calls the dry run', () => {
    const pdfFile = new File(['binary'], 'acme.pdf', { type: 'application/pdf' })
    render(<AddCustomerModal onClose={() => {}} users={users} statuses={statuses} />)
    fireEvent.click(screen.getByRole('button', { name: importCardTitle }))

    const dropZone = screen.getByText(ct('modal.import.intro')).parentElement as HTMLElement
    fireEvent.drop(dropZone, { dataTransfer: { files: [pdfFile] } })

    // The refusal now speaks the shared upload policy (type refusal lists the allowed extensions).
    expect(screen.getByText(st('common:upload.typeNotAllowed', { allowed: 'csv, txt, xlsx' }))).toBeInTheDocument()
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
