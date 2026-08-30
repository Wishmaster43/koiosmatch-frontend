/**
 * AddVacancyModal — SLICE 2 slice (split from AddVacancyModal.test.tsx, §3
 * 1000-line hard-cap, Opus fixAdvies): Matchprofiel, AI-agent card gating +
 * owner-derived seeding (KOIOS-VOORSTEL-1), Publicatie, the post-create
 * attachments sequencing gate and the header Excel/CSV import wizard
 * (EXCEL-VACATURES-1). Titled-cards chrome and the byte-identical base body
 * live in .layout.test.tsx; klant-cascade/Inzet/Functie-eisen/Voorwaarden/
 * Beschrijving live in .cascade.test.tsx.
 *
 * Network-backed hooks are mocked directly (no QueryClient needed, mirrors
 * AddCandidateModal.test.tsx); i18next is uninitialised so t() returns raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'
import { users, usersWithSecond, customers, noop, makeDefaultStatuses, fillTitleAndSubmit, openTab } from './AddVacancyModal.testFixtures'
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
vi.mock('@/context/LookupsContext', () => ({
  // eslint-disable-next-line no-restricted-syntax -- test fixture lookup colour (DATA, not UI styling)
  useLookups: () => ({ candidateTypes: [{ value: 'flex', label: 'Flex', color: '#6E8FD6' }, { value: 'zzp', label: 'ZZP', color: '#79B58E' }] }),
}))
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
// Individual SLICE-2 tests below flip these on.
const { authState } = vi.hoisted(() => ({
  authState: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock grants neither; the param exists only to match hasModule's real signature
    hasModule: (_k: string): boolean => false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default mock grants neither; the param exists only to match hasPermission's real signature
    hasPermission: (_p: string): boolean => false,
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the default no-op mock ignores it; the param exists only to match runSequence's real signature
  attachmentsState: { hasPending: false, runSequence: (async (_id: unknown) => {}) as (id: unknown) => Promise<void> },
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

describe('AddVacancyModal · Matchprofiel (punt 18)', () => {
  const template = { id: 't1', name: 'IC-team', weights: { qualifications: 5, technical_fit: 4, soft_skills: 3, cultural_alignment: 3, career_aspirations: 2, location: 4 }, linkedVacanciesCount: 0 }

  it('picking a template alone sends only match_weight_template_id (server snapshots the weights)', async () => {
    matchTemplatesState.templates = [template]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'matching')
    // A+D layout (03-08): Matchprofiel is a CollapsedCard, closed by default — open it first.
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardMatching' }))
    await user.click(screen.getByRole('button', { name: 'matching.custom' }))
    await user.click(screen.getByRole('button', { name: 'IC-team' }))
    await fillTitleAndSubmit(user)

    const [, body] = mockPost.mock.calls[0]
    expect(body).toMatchObject({ match_weight_template_id: 't1' })
    expect(body).not.toHaveProperty('match_weights')
  })

  it('editing a slider after picking a template sends match_weights alongside the template id', async () => {
    matchTemplatesState.templates = [template]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'matching')
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardMatching' }))
    await user.click(screen.getByRole('button', { name: 'matching.custom' }))
    await user.click(screen.getByRole('button', { name: 'IC-team' }))
    await user.click(screen.getByRole('button', { name: 'matching.adjust' }))
    const slider = screen.getByRole('slider', { name: 'matching.dim.qualifications' })
    slider.focus()
    await user.keyboard('{ArrowLeft}')
    await fillTitleAndSubmit(user)

    const [, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>]
    expect(body.match_weight_template_id).toBe('t1')
    expect(body.match_weights).toMatchObject({ qualifications: 4 })
  })
})

describe('AddVacancyModal · AI-agent card gating (punt 19)', () => {
  it('renders NOTHING without module aiagents + settings.view — never a disabled tease', () => {
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.queryByText('modal.fields.cardAiAgent')).not.toBeInTheDocument()
  })

  it('renders the picker and sends ai_agent_id once both module + permission are present', async () => {
    authState.hasModule = k => k === 'aiagents'
    authState.hasPermission = p => p === 'settings.view'
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    expect(screen.getByText('modal.fields.cardAiAgent')).toBeInTheDocument()
    await openTab(user, 'aiAgent')

    // A+D layout (03-08): AI-agent is a CollapsedCard, closed by default — open it first.
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' }))
    await user.click(screen.getByRole('button', { name: 'aiagent.placeholder' }))
    await user.click(screen.getByRole('button', { name: 'Interview Bot' }))
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ ai_agent_id: 'a1' }))
  })

  // INTERVIEW-WORKFLOW-1 (Appendix D/E), verdict finding 7 (MEDIUM, fixed): the
  // create route does not accept `interview_workflow_id` yet (CMBE's P2), so
  // this field renders disabled with an honest notice on create — never a live
  // picker whose pick the server would silently drop (§3 no fake affordance).
  it('renders the workflow field disabled on create and never sends interview_workflow_id', async () => {
    authState.hasModule = k => k === 'aiagents'
    authState.hasPermission = p => p === 'settings.view'
    interviewWorkflowsState.options = [{ value: 'wf-1', label: 'Kelly · Kelly-Helpende' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'aiAgent')
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' }))
    expect(screen.getByText('aiagent.workflow.createUnavailable')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'aiagent.workflow.placeholder' })).not.toBeInTheDocument()
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.not.objectContaining({ interview_workflow_id: expect.anything() }))
  })
})

describe('AddVacancyModal · AI-agent seeds from the owner (punt 20, KOIOS-VOORSTEL-1)', () => {
  beforeEach(() => {
    authState.hasModule = k => k === 'aiagents'
    authState.hasPermission = p => p === 'settings.view'
  })

  it('seeds the field with the owner-linked agent and shows the Koios mark', async () => {
    aiAgentsState.agents = [{ id: 'a1', name: 'Interview Bot', user: { id: 'u1' } }]
    // AiAgentCard's picker options come from `useAiAgents().options` (label lookup) —
    // a SEPARATE field from `agents` (which useVacancyAgentDefault matches on) — mirror both.
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }]
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await screen.findByText('modal.fields.cardAiAgent')
    const user = userEvent.setup()
    await openTab(user, 'aiAgent')
    // Owner (u1, the logged-in default) has an agent — the card shows it filled + suggested even collapsed.
    expect(screen.getByText('modal.fields.cardAiAgent').closest('button')).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' }))
    expect(screen.getByRole('button', { name: 'Interview Bot' })).toBeInTheDocument()
    expect(screen.getByTestId('koios-suggestion')).toBeInTheDocument()
    expect(screen.getByTestId('koios-suggestion')).toHaveTextContent('koiosSuggestedOwnerAgent')
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ ai_agent_id: 'a1' }))
  })

  it('stays empty and unmarked when the owner has no linked agent', async () => {
    aiAgentsState.agents = [{ id: 'a1', name: 'Interview Bot', user: { id: 'u2' } }]
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'aiAgent')
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' }))
    expect(screen.getByRole('button', { name: 'aiagent.placeholder' })).toBeInTheDocument()
    expect(screen.queryByTestId('koios-suggestion')).not.toBeInTheDocument()
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.not.objectContaining({ ai_agent_id: expect.anything() }))
  })

  it('re-suggests when the owner changes', async () => {
    aiAgentsState.agents = [
      { id: 'a1', name: 'Interview Bot', user: { id: 'u1' } },
      { id: 'a2', name: 'Zorg Bot', user: { id: 'u2' } },
    ]
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }, { value: 'a2', label: 'Zorg Bot' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={usersWithSecond} customers={customers} />)
    await openTab(user, 'aiAgent')
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' }))
    expect(screen.getByRole('button', { name: 'Interview Bot' })).toBeInTheDocument()

    // Switch owner to Anne Manager (u2) — the RecruiterCard lives on the General
    // tab, so switch there to reach it (the owner trigger's accessible name is
    // its FIELD LABEL, not the picked value — its <label> is aria-labelledby'd
    // onto the button, so it never reads "Piet Recruiter") — then back to see the re-suggestion.
    await openTab(user, 'general')
    await user.click(screen.getByRole('button', { name: 'modal.fields.owner' }))
    await user.click(screen.getByRole('button', { name: 'Anne Manager' }))
    await openTab(user, 'aiAgent')
    expect(screen.getByRole('button', { name: 'Zorg Bot' })).toBeInTheDocument()
    expect(screen.getByTestId('koios-suggestion')).toBeInTheDocument()

    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ ai_agent_id: 'a2' }))
  })

  it('clearing the suggestion freezes it empty and the clear reaches the submitted payload', async () => {
    aiAgentsState.agents = [{ id: 'a1', name: 'Interview Bot', user: { id: 'u1' } }]
    aiAgentsState.options = [{ value: 'a1', label: 'Interview Bot' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'aiAgent')
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardAiAgent' }))
    expect(screen.getByTestId('koios-suggestion')).toBeInTheDocument()

    // Clear the auto-seeded value by hand via the wiskruis (VAC-CLEAR-1) — the
    // clear button's accessible name is the mocked `clearField` key for EVERY clearable
    // picker (t() ignores interpolation), so the owner field's own clear-X shares the same
    // name; the agent card's is the LAST one in DOM order (RecruiterCard renders first).
    const clearButtons = screen.getAllByRole('button', { name: 'clearField' })
    await user.click(clearButtons[clearButtons.length - 1])

    expect(screen.queryByTestId('koios-suggestion')).not.toBeInTheDocument()
    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.not.objectContaining({ ai_agent_id: expect.anything() }))
  })
})

describe('AddVacancyModal · Publicatie (punt 20)', () => {
  it('omits published/published_channels/application_settings entirely when untouched (base body stays byte-identical)', async () => {
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await fillTitleAndSubmit(user)
    const [, body] = mockPost.mock.calls[0]
    expect(body).not.toHaveProperty('published')
    expect(body).not.toHaveProperty('published_channels')
    expect(body).not.toHaveProperty('application_settings')
  })

  it('carries published, published_channels and application_settings once touched', async () => {
    lookupState.channels = [{ value: 'indeed', label: 'Indeed' }]
    const user = userEvent.setup()
    render(<AddVacancyModal onClose={noop} users={users} customers={customers} />)
    await openTab(user, 'publication')

    // A+D layout (03-08): Publicatie is a CollapsedCard, closed by default — open it first.
    await user.click(screen.getByRole('button', { name: 'modal.fields.cardPublication' }))
    // Master published toggle (the table/insights "Gepubliceerd" bucket).
    await user.click(screen.getByRole('switch', { name: 'columns.published' }))
    // One job-board channel toggle.
    await user.click(screen.getByRole('switch', { name: 'Indeed' }))
    // One application-setting change — the trigger is scoped to the CV row; the
    // OPTIONS live in the portalled menu (PORTAL-MARKER-1), the only one open.
    const cvRow = screen.getByText('publishing.fields.cv').parentElement as HTMLElement
    await user.click(within(cvRow).getByRole('button'))
    const menu = document.querySelector('[data-dropdown-portal]') as HTMLElement
    await user.click(within(menu).getByRole('button', { name: 'publishing.values.optional' }))

    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      published: true,
      published_channels: [{ value: 'indeed', published: true }],
      application_settings: expect.objectContaining({ cv: 'optional' }),
    }))
  })
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
