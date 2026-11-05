/** AddVacancyModal · post-create attachments gate and header Excel/CSV import (split from AddVacancyModal.slice2.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'
import { users, customers, noop, makeDefaultStatuses, fillTitleAndSubmit } from './AddVacancyModal.testFixtures'
// EXCEL-VACATURES-1: only the NETWORK calls are mocked — useImportWizard,
// EntityImportCard, PreviewStep and ResultStep all run for REAL, so the import
// tests below prove the actual wizard wiring (dry-run-before-real-run, close +
// refresh on success), not a stub of it (mirrors AddCustomerModal.test.tsx).
import { dryRunImport, runImport, type ImportRunResult } from '@/pages/settings/sections/import/importApi'

vi.mock('@/pages/settings/sections/import/importApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/settings/sections/import/importApi')>()
  return { ...actual, dryRunImport: vi.fn(), runImport: vi.fn(), downloadImportTemplate: vi.fn() }
})

// useAddVacancyForm reuses composeAddress from useVacancyDetailsForm.ts, which
// (for the DRAWER's own date formatting) imports lib/datetime -> src/i18n's real
// instance -> react-i18next's initReactI18next — so the mock below must still
// export a usable stub for it, or that eager import chain throws at module load.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'nl' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const { lookupState } = vi.hoisted(() => ({
  lookupState: {
    statuses: [] as Array<{ value: string; label: string; color?: string }>,
    // PublicationCard's channel list — empty by default so the base tests
    // never see a `published_channels` key (nothing to toggle).
    channels: [] as Array<{ value: string; label: string }>,
  },
}))
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({
    statuses: lookupState.statuses,
    seniorityLevels: [{ value: 'senior', label: 'Senior' }, { value: 'medior', label: 'Medior' }],
    educationLevels: [{ value: 'hbo', label: 'HBO' }],
    defaultSeniority: '', defaultEducation: '',
    channels: lookupState.channels,
  }),
}))
vi.mock('@/context/LookupsContext', async () => {
  const { CANDIDATE_TYPES } = await import('./AddVacancyModal.slice2.testKit')
  return { useLookups: () => ({ candidateTypes: CANDIDATE_TYPES }) }
})
vi.mock('@/lib/useIndustries', () => ({ useIndustries: () => ({ industries: ['Zorg', 'IT'], industryOptions: ['Zorg', 'IT'].map(n => ({ value: n, label: n })) }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'], functionOptions: ['Verzorgende IG', 'Helpende'].map(n => ({ value: n, label: n })), allowFreeEntry: false }) }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Vestiging Noord' }, { value: 'branch-2', label: 'Vestiging Zuid' }],
}))
vi.mock('@/hooks/useProvinces', () => ({ useProvinces: () => ({ provinces: ['Zuid-Holland', 'Utrecht'] }) }))
// The cascade fetch itself — stubbed so this slice never touches the cascade
// narrowing logic (that is the .cascade.test.tsx file's own concern).
const { cascadeState } = vi.hoisted(() => ({
  cascadeState: {
    byCustomer: {} as Record<string, {
      locations: Array<{ id: string; name: string; departments?: Array<{ id: string; name: string }> }>
      contacts: Array<{ id: string; name: string }>
      branch_id?: string
    }>,
  },
}))
const detailByCustomer = new Map<string, { branch_id: string | null } | null>()
vi.mock('@/hooks/useCustomerCascade', () => ({
  useCustomerCascade: (customerId: string) => {
    const data = cascadeState.byCustomer[customerId] ?? { locations: [], contacts: [] }
    if (!detailByCustomer.has(customerId)) {
      detailByCustomer.set(customerId, customerId ? { branch_id: data.branch_id ?? null } : null)
    }
    return { detail: detailByCustomer.get(customerId) ?? null, locations: data.locations, contacts: data.contacts, refetch: vi.fn() }
  },
}))
// Hoisted, mutable auth state — defaults to no module/no permission (both
// SLICE-2 gates stay closed), so the base tests never see AiAgentCard/AttachmentsCard.
// Individual SLICE-2 tests in AddVacancyModal.slice2.test.tsx flip these on.
const { authState } = vi.hoisted(() => ({
  authState: {
    // The default mock grants neither; typed to match the real signatures.
    hasModule: (() => false) as (module: string) => boolean,
    hasPermission: (() => false) as (perm: string) => boolean,
  },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Piet Recruiter' }, hasModule: authState.hasModule, hasPermission: authState.hasPermission }),
}))
// SLICE 2's new query-backed hooks — mocked directly (no QueryClient in this
// tree, mirrors the file's own convention above) so the base tests never touch
// the network.
// Hoisted, mutable template list — the Matchprofiel test needs one real
// template to prove picking it (vs. editing a slider) sends different bodies.
const { matchTemplatesState } = vi.hoisted(() => ({
  matchTemplatesState: { templates: [] as Array<{ id: string; name: string; weights: Record<string, number>; linkedVacanciesCount: number }> },
}))
vi.mock('./hooks/useMatchWeightTemplates', () => ({ useMatchWeightTemplates: () => ({ templates: matchTemplatesState.templates, loading: false, error: false }) }))
// Hoisted, mutable agent list — the gating test flips authState on and needs
// at least one real option to prove ai_agent_id rides the create body.
const { aiAgentsState } = vi.hoisted(() => ({
  aiAgentsState: {
    options: [] as Array<{ value: string; label: string }>,
    // Punt 20: the raw agent records — carries `user` so the owner-derived
    // suggestion (useVacancyAgentDefault) has something to match against.
    agents: [] as Array<{ id: string; name: string; user?: { id: string; name?: string } | null }>,
  },
}))
vi.mock('./hooks/useAiAgents', () => ({ useAiAgents: () => ({ options: aiAgentsState.options, agents: aiAgentsState.agents, loading: false, error: false }) }))
// INTERVIEW-WORKFLOW-1: AiAgentCard's optional companion picker — flat-object
// mock (no QueryClientProvider in this suite, mirrors useAiAgents above).
const { interviewWorkflowsState } = vi.hoisted(() => ({
  interviewWorkflowsState: { options: [] as Array<{ value: string; label: string }> },
}))
vi.mock('@/hooks/useInterviewWorkflows', () => ({
  useInterviewWorkflows: () => ({ options: interviewWorkflowsState.options, workflows: [], byId: new Map(), loading: false, error: false }),
}))
// PublicationCard's tenant-default lookup — mocked so it never depends on the
// module-level useAllSettings cache/real `api.get('/settings')` round-trip
// (that hook's own cache is shared across test files by design, §9).
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getJsonSetting: (_values: unknown, _key: string, fallback: unknown) => fallback,
}))
vi.mock('./addmodal/useGenerateDescription', () => ({
  useGenerateDescription: () => ({
    open: false, openFlow: vi.fn(), closeFlow: vi.fn(), profile: null, resolving: false, resolveFailed: false,
    noProfileConfigured: false, status: 'idle', concept: '', generate: vi.fn(), discard: vi.fn(),
  }),
}))
// Hoisted, mutable post-create-attachments state — the sequencing-gate test
// flips `hasPending` on to prove the submit path decides whether to run it.
const { attachmentsState } = vi.hoisted(() => ({
  // The default no-op mock ignores its argument; typed to match runSequence's real signature.
  attachmentsState: { hasPending: false, runSequence: (async () => {}) as (id: unknown) => Promise<void> },
}))
vi.mock('./addmodal/usePostCreateAttachments', () => ({
  usePostCreateAttachments: () => ({
    files: [], addFile: vi.fn(), removeFile: vi.fn(),
    noteText: '', setNoteText: vi.fn(), noteStatus: 'idle', noteError: '',
    running: false, hasPending: attachmentsState.hasPending, runSequence: attachmentsState.runSequence,
    retryFile: vi.fn(), retryNote: vi.fn(),
  }),
}))
// Tiptap needs a real browser to mount — stubbed with a plain controlled
// textarea (mirrors AddCandidateModal.test.tsx / AddLocationModal.test.tsx);
// CollapsibleRichText itself runs for real around it.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="rich-text-editor" value={value} onChange={e => onChange(e.target.value)} />
  ),
}))

const mockPost = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})

beforeEach(() => {
  detailByCustomer.clear()
  lookupState.statuses = makeDefaultStatuses()
  lookupState.channels = []
  authState.hasModule = () => false
  authState.hasPermission = () => false
  aiAgentsState.options = []
  aiAgentsState.agents = []
  interviewWorkflowsState.options = []
  matchTemplatesState.templates = []
  attachmentsState.hasPending = false
  attachmentsState.runSequence = async () => {}
  cascadeState.byCustomer = {}
  mockPost.mockReset()
  mockPost.mockResolvedValue({ data: { data: { id: 'v-new', title: 'Verpleegkundige' } } })
  vi.mocked(dryRunImport).mockReset()
  vi.mocked(runImport).mockReset()
})

describe('AddVacancyModal · post-create attachments sequencing gate (punten 21+22)', () => {
  it('closes immediately when nothing is pending (the common case, pre-SLICE-2 behaviour)', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={onClose} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT run the post-create sequence without vacancies.update, even with pending attachments', async () => {
    attachmentsState.hasPending = true
    const runSequence = vi.fn(async () => {})
    attachmentsState.runSequence = runSequence
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={onClose} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    expect(runSequence).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('runs the post-create sequence with the new id and shows the results panel instead of closing', async () => {
    authState.hasPermission = p => p === 'vacancies.update'
    attachmentsState.hasPending = true
    const runSequence = vi.fn(async () => {})
    attachmentsState.runSequence = runSequence
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={onClose} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)

    expect(runSequence).toHaveBeenCalledWith('v-new')
    expect(onClose).not.toHaveBeenCalled()
    // POPUP-SLEEP-1: the panel title bar repeats the results heading — assert presence, not uniqueness.
    expect(screen.getAllByText('modal.attachments.resultsTitle').length).toBeGreaterThan(0)
  })
})

// EXCEL-VACATURES-1 (Danny 14-08, screenshot: "Excel importeren moet in de pop-up
// + nieuwe vacature niet hier boven de tabel!!"): the toolbar's Excel/CSV import
// button moved into THIS modal's header — mirrors AddCustomerModal's own
// import-card tests (KLANT-LAYOUT-3) 1:1, now pointed at the 'vacancies' template.
describe('AddVacancyModal · Excel/CSV import in the header (EXCEL-VACATURES-1)', () => {
  const csvFile = new File(['functietitel\nVerpleegkundige'], 'vacatures.csv', { type: 'text/csv' })
  // A dry run that would land one row — enough to unlock the real-import confirm.
  const cleanResult: ImportRunResult = {
    entity: 'vacancies', dry_run: true,
    summary: { rows: 1, create: 1, update: 0, skip: 0, error: 0 },
    unknown_columns: [],
    rows: [{ row: 1, action: 'create', reference: 'Verpleegkundige', id: null, messages: [] }],
  }

  it('never renders the header import toggle without vacancies.create — no fake affordance', () => {
    // authState.hasPermission defaults to "grants nothing" in beforeEach above.
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByRole('button', { name: 'modal.import.title' })).not.toBeInTheDocument()
  })

  it('renders the header import toggle once vacancies.create is granted, collapsed by default', () => {
    authState.hasPermission = p => p === 'vacancies.create'
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByRole('button', { name: 'modal.import.title' })).toHaveAttribute('aria-expanded', 'false')
    // No upload control until the toggle is opened.
    expect(screen.queryByLabelText('import.selectCsv')).not.toBeInTheDocument()
  })

  it('opening the toggle reveals the import card as the first card in the body', async () => {
    authState.hasPermission = p => p === 'vacancies.create'
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    expect(screen.getByRole('button', { name: 'modal.import.title' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('modal.import.intro')).toBeInTheDocument()
    expect(screen.getByLabelText('import.selectCsv')).toBeInTheDocument()
  })

  it('the upload input advertises .csv, .txt AND .xlsx (backend: ImportUploadRequest mimes:csv,txt,xlsx)', async () => {
    authState.hasPermission = p => p === 'vacancies.create'
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    const input = screen.getByLabelText('import.selectCsv') as HTMLInputElement
    expect(input.accept).toBe('.csv,.txt,.xlsx')
  })

  it('a dry run fires the REAL request against the vacancy template, never the real import', async () => {
    authState.hasPermission = p => p === 'vacancies.create'
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))

    // Before any file is picked, no confirm/real-import control exists at all.
    expect(screen.queryByRole('button', { name: 'import.preview.confirm' })).not.toBeInTheDocument()

    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))

    expect(dryRunImport).toHaveBeenCalledTimes(1)
    expect(dryRunImport).toHaveBeenCalledWith('vacancies', expect.any(File))
    expect(runImport).not.toHaveBeenCalled()
    // ONLY once the dry run has resolved does the real-import control appear.
    expect(await screen.findByRole('button', { name: 'import.preview.confirm' })).toBeInTheDocument()
  })

  it('closes the modal and refreshes the list once a real import lands something', async () => {
    authState.hasPermission = p => p === 'vacancies.create'
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    vi.mocked(runImport).mockResolvedValue({
      ...cleanResult, dry_run: false, rows: [{ ...cleanResult.rows[0], id: 'v1' }],
    })
    const onClose = vi.fn()
    const onImported = vi.fn()
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={onClose} onImported={onImported} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))

    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))
    await user.click(await screen.findByRole('button', { name: 'import.preview.confirm' }))

    // The auto-close effect fires once the run RESULT lands something — never
    // leaving the untouched manual form open behind a vacancy that now exists.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(runImport).toHaveBeenCalledWith('vacancies', expect.any(File))
  })

  it('blocks the manual Create button while the import is past its upload step — never two creation paths armed at once', async () => {
    authState.hasPermission = p => p === 'vacancies.create'
    vi.mocked(dryRunImport).mockResolvedValue(cleanResult)
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await user.click(screen.getByRole('button', { name: 'modal.import.title' }))
    await user.upload(screen.getByLabelText('import.selectCsv'), csvFile)
    await user.click(screen.getByRole('button', { name: 'import.runPreview' }))
    await screen.findByRole('button', { name: 'import.preview.confirm' })

    await user.type(screen.getByPlaceholderText('modal.titlePlaceholder'), 'Verpleegkundige')
    expect(screen.getByRole('button', { name: 'modal.create' })).toBeDisabled()
    expect(mockPost).not.toHaveBeenCalledWith('/vacancies', expect.anything())
  })
})
