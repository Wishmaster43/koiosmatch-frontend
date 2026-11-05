/** AddCandidateModal · header import and required custom field (split from AddCandidateModal.test.tsx; same mock header, own tests). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddCandidateModal from './AddCandidateModal'
// CAND-IMPORT-FE-1: only the NETWORK calls are mocked — useImportWizard,
// EntityImportCard, PreviewStep and ResultStep all run for REAL, so the import
// tests below prove the actual wizard wiring (dry-run-before-real-run, close +
// refresh on success), not a stub of it (mirrors AddVacancyModal.test.tsx).
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

// Hoisted mutable test state: per-test settings blob + permissions, plus the
// create spy the component's mocked mutation hook hands back.
const { state, createCandidate, getMock, postMock } = vi.hoisted(() => ({
  state: { settings: {} as Record<string, unknown>, permissions: ['candidates.update'] as string[] },
  // Typed with the body param so mock.calls[0][0] is a typed body in assertions.
  createCandidate: vi.fn<(body: Record<string, unknown>) => Promise<{ id: string }>>(async () => ({ id: 'cand-new' })),
  getMock: vi.fn(),
  postMock: vi.fn(),
}))
// The duplicate probe + restore talk to the real axios client — mock the seam so
// the tests can assert the REQUEST (route + params/body), not just a callback.
vi.mock('@/lib/api', () => ({ default: { get: getMock, post: postMock } }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// ONIX N-005: this modal's own RequiredCustomFieldsCard calls useCustomFields
// directly — mocked here (as every other create-modal test does, see
// AddApplicationModal.test.tsx) so it never reaches the above @/lib/api stub,
// which does not implement getActiveTenantId. No required def by default.
// B1: per-test required custom field defs for the host under test (empty by default).
const { customFieldsState } = vi.hoisted(() => ({ customFieldsState: { fields: [] as unknown[] } }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: customFieldsState.fields, allFields: customFieldsState.fields, loading: false, error: false, invalidate: vi.fn(), refetch: vi.fn() }) }))

// Tenant lookups/auth/users/locations are network-backed hooks — mocked directly
// so the test isolates this modal's own wiring.
vi.mock('@/context/LookupsContext', async () => {
  const { phases } = await import('./AddCandidateModal.testKit')
  return { useLookups: () => ({ phases }) }
})
// Keep the REAL getJsonSetting (the component parses the required-fields config
// through it); only the settings blob itself is test-controlled.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => state.settings }
})
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [{ value: 'male', label: 'Man' }, { value: 'female', label: 'Vrouw' }] }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({
  user: { id: 'u1', name: 'Piet Recruiter', branch_ids: ['b1'] },
  hasPermission: (p: string) => state.permissions.includes(p),
}) }))
vi.mock('./hooks/useCandidateMutations', () => ({ useCreateCandidate: () => ({ createCandidate, saving: false }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], functionOptions: [{ value: 'Verzorgende IG', label: 'Verzorgende IG' }], allowFreeEntry: true }) }))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: [{ value: 'Utrecht', label: 'Utrecht' }] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'b1', label: 'Vestiging Noord' }, { value: 'b2', label: 'Vestiging Zuid' }] }))
// PROFILE-TEXT-1: Tiptap needs a real browser to mount — stubbed with a plain
// controlled textarea, mirrors the house convention (AddLocationModal.test.tsx /
// MatchModal.test.tsx). CollapsibleRichText itself runs for REAL, so the test
// in AddCandidateModal.test.tsx proves the actual collapsed-ghost -> reveal -> submit wiring.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

const noop = () => {}

beforeEach(() => {
  state.settings = {}
  state.permissions = ['candidates.update']
  createCandidate.mockReset()
  customFieldsState.fields = []
  createCandidate.mockResolvedValue({ id: 'cand-new' })
  getMock.mockReset()
  // Default probe answer: nobody found (so the create-body tests stay unaffected).
  getMock.mockResolvedValue({ data: { exists: false, match: null } })
  postMock.mockReset()
  postMock.mockResolvedValue({ data: {} })
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

// CAND-IMPORT-FE-1 (23-08): the Excel/CSV import affordance in the header —
// mirrors AddVacancyModal's own import describe block 1:1, pointed at the
// 'candidates' template (koiosmatch-api CandidateImporter).
describe('AddCandidateModal · Excel/CSV import in the header (CAND-IMPORT-FE-1)', () => {
  const csvFile = new File(['achternaam\nJansen'], 'kandidaten.csv', { type: 'text/csv' })
  // A dry run that would land one row — enough to unlock the real-import confirm.
  const cleanResult: ImportRunResult = {
    entity: 'candidates', dry_run: true,
    summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
    unknown_columns: [],
    rows: [{ row: 1, action: 'create', reference: 'Jansen', id: null, messages: [] }],
  }

  it('never renders the header import toggle without candidates.create — no fake affordance', () => {
    // state.permissions defaults to ['candidates.update'] in beforeEach.
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.queryByRole('button', { name: 'modal.import.title' })).not.toBeInTheDocument()
  })

  it('renders the header import toggle once candidates.create is granted, collapsed by default', () => {
    state.permissions = ['candidates.update', 'candidates.create']
    render(<AddCandidateModal onClose={noop} />)
    expect(screen.getByRole('button', { name: 'modal.import.title' })).toHaveAttribute('aria-expanded', 'false')
    // No upload control until the toggle is opened.
    expect(screen.queryByLabelText('import.selectCsv')).not.toBeInTheDocument()
  })

  it('opening the toggle reveals the import card as the first card in the body', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    expect(screen.getByRole('button', { name: 'modal.import.title' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('modal.import.intro')).toBeInTheDocument()
    expect(screen.getByLabelText('import.selectCsv')).toBeInTheDocument()
  })

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    const input = screen.getByLabelText('import.selectCsv') as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('a dry run fires the REAL request against the candidate template, never the real import', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))

    // Before any file is picked, no confirm/real-import control exists at all.
    expect(screen.queryByRole('button', { name: 'import.preview.confirm' })).not.toBeInTheDocument()

    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))

    expect(dryRunImport).toHaveBeenCalledTimes(1)
    expect(dryRunImport).toHaveBeenCalledWith('candidates', expect.any(File))
    expect(runImport).not.toHaveBeenCalled()
    // ONLY once the dry run has resolved does the real-import control appear.
    expect(await screen.findByRole('button', { name: 'import.preview.confirm' })).toBeInTheDocument()
  })

  it('closes the modal and refreshes the list once a real import lands something', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    vi.mocked(runImport).mockResolvedValue({
      ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'c1' }],
    })
    const onClose = vi.fn()
    const onImported = vi.fn()
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={onClose} onImported={onImported} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))

    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))
    await user.click(await screen.findByRole('button', { name: 'import.preview.confirm' }))

    // The auto-close effect fires once the run RESULT lands something — never
    // leaving the untouched manual form open behind a candidate that now exists.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(runImport).toHaveBeenCalledWith('candidates', expect.any(File))
  })

  it('blocks the manual Create button while the import is past its upload step — never two creation paths armed at once', async () => {
    state.permissions = ['candidates.update', 'candidates.create']
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))
    await screen.findByRole('button', { name: 'import.preview.confirm' })

    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
    expect(createCandidate).not.toHaveBeenCalled()
  })
})

// B1 (#79): an untouched REQUIRED boolean custom field is an answer (false) — it must not block, and must ride in the POST body.
describe('AddCandidateModal · required boolean custom field', () => {
  it('creates with custom_fields { gdpr: false } when the checkbox is left untouched', async () => {
    customFieldsState.fields = [{ key: 'gdpr', label: 'GDPR', type: 'boolean', sort_order: 0, active: true, has_data: false, visible_in_ui: true, required_always: true, required_for: [] }]
    const user = userEvent.setup()
    render(<AddCandidateModal onClose={noop} onCreated={noop} />)
    await user.type(screen.getByPlaceholderText('common:placeholders.firstName'), 'Jan')
    await user.type(screen.getByPlaceholderText('common:placeholders.lastName'), 'Jansen')
    const createBtn = screen.getByRole('button', { name: 'modal.create' })
    expect(createBtn).not.toBeDisabled()
    await user.click(createBtn)
    await waitFor(() => expect(createCandidate).toHaveBeenCalledTimes(1))
    expect(createCandidate.mock.calls[0][0].custom_fields).toEqual({ gdpr: false })
  })
})
