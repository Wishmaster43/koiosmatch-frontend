/**
 * AddVacancyModal — SLICE 2 slice (split from AddVacancyModal.test.tsx, §3
 * 1000-line hard-cap, Opus fixAdvies): Matchprofiel, AI-agent card gating +
 * owner-derived seeding (KOIOS-VOORSTEL-1) and Publicatie. The post-create
 * attachments sequencing gate and the header Excel/CSV import wizard
 * (EXCEL-VACATURES-1) live in .import.test.tsx. Titled-cards chrome and the byte-identical base body
 * live in .layout.test.tsx; klant-cascade/Inzet/Functie-eisen/Voorwaarden/
 * Beschrijving live in .cascade.test.tsx.
 *
 * Network-backed hooks are mocked directly (no QueryClient needed, mirrors
 * AddCandidateModal.test.tsx); i18next is uninitialised so t() returns raw keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddVacancyModal from './AddVacancyModal'
import { users, usersWithSecond, customers, noop, makeDefaultStatuses, fillTitleAndSubmit, openTab } from './AddVacancyModal.testFixtures'
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
// Individual SLICE-2 tests below flip these on.
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
    // §3 no-fake-affordance fix: "Gepubliceerd" is now a derived, non-interactive
    // read-out (no `switch` role any more) — only the channel toggle below persists.
    // One job-board channel toggle.
    await user.click(screen.getByRole('switch', { name: 'Indeed' }))
    // One application-setting change — the trigger is scoped to the CV row; the
    // OPTIONS live in the portalled menu (PORTAL-MARKER-1), the only one open.
    const cvRow = screen.getByText('publishing.fields.cv').parentElement as HTMLElement
    // DROPDOWN-CLEAR-1: filter to the trigger button (has aria-haspopup), not the clear X.
    const cvButtons = within(cvRow).getAllByRole('button')
    const cvTrigger = cvButtons.find(btn => btn.hasAttribute('aria-haspopup'))!
    await user.click(cvTrigger)
    const menu = document.querySelector('[data-dropdown-portal]') as HTMLElement
    await user.click(within(menu).getByRole('button', { name: 'publishing.values.optional' }))

    await fillTitleAndSubmit(user)
    expect(mockPost).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      // O-25: no bare `published` key any more — the channel list carries the intent.
      published_channels: [{ value: 'indeed', published: true }],
      application_settings: expect.objectContaining({ cv: 'optional' }),
    }))
  })
})
