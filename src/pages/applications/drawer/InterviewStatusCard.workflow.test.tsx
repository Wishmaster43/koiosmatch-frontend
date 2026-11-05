/** InterviewStatusCard · workflow override picker, vacancy default and skip flows (split from InterviewStatusCard.test.tsx; mock header duplicated per file by design). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InterviewStatusCard from './InterviewStatusCard'
import { fullInterview } from './InterviewStatusCard.testKit'

// Deterministic key-echo (repo-wide precedent, e.g. ApplicationTab.test.tsx) —
// avoids the real async-initialising i18n singleton in a unit test. `mockT` is a
// real vi.fn so a specific test can override it (e.g. to assert interpolation
// options) without disturbing every other test's plain key-echo default.
const mockT = vi.fn((k: string) => k)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }))

// Deterministic date echo: keeps the real i18n singleton out of the unit test.
vi.mock('@/lib/localDate', async () => ({ ...(await vi.importActual<object>('@/lib/localDate')), formatDateTimeStr: (v: string) => `dt(${v})` }))

const mockUseAuth = vi.fn()
const mockPost = vi.fn()
const mockGet = vi.fn()
const mockPatch = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
const mockOpenEntity = vi.fn()

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: mockOpenEntity, navigate: vi.fn() }) }))
// INTERVIEW-PICKER-AUTHZ-FE: same flat-object idiom as useAiAgents mocks repo-wide
// (e.g. AddVacancyModal.slice2.test.tsx) — this suite has no QueryClientProvider,
// so the real react-query hook cannot mount.
const mockWorkflowById = new Map([
  ['wf-1', { id: 'wf-1', name: 'Kelly-Helpende', agent: { id: 'a1', name: 'Kelly' } }],
])
vi.mock('@/hooks/useInterviewOptions', () => ({
  useInterviewOptions: () => ({
    workflowOptions: [{ value: 'wf-1', label: 'Kelly · Kelly-Helpende' }], workflowById: mockWorkflowById,
    describeWorkflow: () => null, agentOptions: [], agents: [], loading: false, error: false, forbidden: false,
  }),
}))
// `unwrap` mirrors the real implementation (data → data.data) so the assertions
// exercise the same envelope handling the app does.
vi.mock('@/lib/api', () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  unwrap: (res: unknown) => {
    const body = (res as { data?: unknown })?.data ?? res
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) return (body as { data: unknown }).data
    return body
  },
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))


beforeEach(() => {
  // resetAllMocks (not clearAllMocks): it also drops leftover `…Once` queues, so a
  // test whose request never fires cannot hand its canned response to the next one.
  vi.resetAllMocks()
  // resetAllMocks drops mockT's implementation too — restore the default key-echo.
  mockT.mockImplementation((k: string) => k)
  mockOpenEntity.mockReset()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
  mockPatch.mockResolvedValue({ data: {} })
  // Default refetch answer; individual tests override it when they assert on it.
  mockGet.mockResolvedValue({ data: { data: {} } })
})

describe('InterviewStatusCard · workflow override picker (INTERVIEW-WORKFLOW-1)', () => {
  it('presence gate absent: renders disabled with the honest notice, no PATCH on interaction', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId={null} hasInterviewWorkflowField={false} />)
    expect(screen.getByText('vacancies:aiagent.workflow.unavailable')).toBeInTheDocument()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('presence gate present: picking a workflow PATCHes exactly { interview_workflow_id }, clearing sends null', async () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId={null} hasInterviewWorkflowField />)
    const user = userEvent.setup()

    const trigger = screen.getByRole('button', { name: 'aiagent.workflow.placeholder' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Kelly · Kelly-Helpende' }))
    expect(mockPatch).toHaveBeenCalledWith('/applications/app-1', { interview_workflow_id: 'wf-1' })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Kelly · Kelly-Helpende' })).toBeInTheDocument())
    await user.click(screen.getByTitle('clearField'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/applications/app-1', { interview_workflow_id: null }))
  })

  it('the workflow picker resolves the linked workflow from the fetched list, own name/agent shown', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId="wf-1" hasInterviewWorkflowField />)
    expect(screen.getByRole('button', { name: 'Kelly · Kelly-Helpende' })).toBeInTheDocument()
    expect(screen.queryByText('aiagent.workflow.empty')).not.toBeInTheDocument()
  })
})

// INTERVIEW-VISIBILITY-1 (Danny 29-09): once this application has NO own
// workflow, an honest caption names the vacancy's default (or says there is
// none) instead of a second interactive picker — plus a button to go set it.
describe('InterviewStatusCard · vacancy-default block (INTERVIEW-VISIBILITY-1)', () => {
  const VACANCY_WF = { id: 'wf-vac', name: 'Vacancy workflow', agent: { id: 'a-vac', name: 'Vacancy agent' } }

  it('shows the vacancy default caption + a button to the vacancy when the application has none of its own', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId={null} hasInterviewWorkflowField
      vacancyId="v-1" vacancyInterviewWorkflow={VACANCY_WF} />)
    expect(screen.getByText('interview.status.vacancyDefault')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'interview.status.editInVacancy' })).toBeInTheDocument()
  })

  it('opens the vacancy drawer on the aiagent tab when the button is clicked', async () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId={null} hasInterviewWorkflowField
      vacancyId="v-1" vacancyInterviewWorkflow={VACANCY_WF} />)
    await userEvent.click(screen.getByRole('button', { name: 'interview.status.editInVacancy' }))
    expect(mockOpenEntity).toHaveBeenCalledWith('vacancies', 'v-1', 'aiagent')
  })

  it('shows the honest "no workflow" caption when neither the application nor the vacancy has one', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId={null} hasInterviewWorkflowField
      vacancyId="v-1" vacancyInterviewWorkflow={null} />)
    expect(screen.getByText('interview.status.noWorkflow')).toBeInTheDocument()
  })

  it('hides the vacancy-default block once the application has its own linked workflow', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId="wf-1" hasInterviewWorkflowField
      vacancyId="v-1" vacancyInterviewWorkflow={VACANCY_WF} />)
    expect(screen.queryByText('interview.status.vacancyDefault')).not.toBeInTheDocument()
    expect(screen.queryByText('interview.status.noWorkflow')).not.toBeInTheDocument()
  })

  it('says nothing (no false "no workflow" claim) when the backend does not report the vacancy workflow key at all, but still shows the edit button', () => {
    render(<InterviewStatusCard interview={fullInterview()} applicationId="app-1" interviewWorkflowId={null} hasInterviewWorkflowField
      vacancyId="v-1" vacancyInterviewWorkflow={undefined} />)
    expect(screen.queryByText('interview.status.noWorkflow')).not.toBeInTheDocument()
    expect(screen.queryByText('interview.status.vacancyDefault')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'interview.status.editInVacancy' })).toBeInTheDocument()
  })
})

describe('InterviewStatusCard · skip reason (ONIX K-006)', () => {
  it.each(['no_interview_consent', 'ai_disclosure_missing'])('renders the %s line when no interview started', reason => {
    render(<InterviewStatusCard interview={null} skipReason={reason} />)
    expect(screen.getByText(`interview.skipReason.${reason}`)).toBeInTheDocument()
  })

  it('renders no skip line when the reason is absent (an unknown code reads generically, see below)', () => {
    render(<InterviewStatusCard interview={null} />)
    expect(screen.queryByText(/interview\.skipReason/)).not.toBeInTheDocument()
  })
})


describe('InterviewStatusCard · skip line composition', () => {
  it('renders the reason and the date as separate nodes', () => {
    render(<InterviewStatusCard interview={null} skipReason="brand_new_code" skippedAt="2026-10-01T10:00:00Z" />)
    expect(screen.getByText('interview.skipReason.unknown')).toBeInTheDocument()
    expect(screen.getByText('interview.skippedAt')).toBeInTheDocument()
  })

  it('renders no date node without skippedAt', () => {
    render(<InterviewStatusCard interview={null} skipReason="brand_new_code" />)
    expect(screen.queryByText('interview.skippedAt')).not.toBeInTheDocument()
  })
})

describe('InterviewStatusCard · skipped start (INTERVIEW-SKIP-ON-APPLICATION-1)', () => {
  const CODES = ['rejected_stage', 'placed_stage', 'no_mobile_or_consent', 'action_rule_blocked', 'no_interview_consent', 'wa_web_send_not_supported', 'no_active_connection', 'send_failed', 'ai_disclosure_missing', 'candidate_in_other_interview', 'already_has_session', 'interview_flow_inactive']

  it.each(CODES)('renders the line for %s', code => {
    render(<InterviewStatusCard interview={null} skipReason={code} />)
    expect(screen.getByText(`interview.skipReason.${code}`)).toBeInTheDocument()
  })

  it('falls back to the generic line for an unknown code, never the raw code', () => {
    render(<InterviewStatusCard interview={null} skipReason="brand_new_code" />)
    expect(screen.getByText('interview.skipReason.unknown')).toBeInTheDocument()
    expect(screen.queryByText(/brand_new_code/)).toBeNull()
  })

  it('appends the skip date in the house format when given', () => {
    // Echo the interpolated date so the RENDERED text proves the result of t() is used.
    mockT.mockImplementation(((k: string, o?: { date?: string }) => (o?.date ? `${k}:${o.date}` : k)) as never)
    try {
      render(<InterviewStatusCard interview={null} skipReason="send_failed" skippedAt="2026-10-21T09:30:00Z" />)
      expect(screen.getByText('interview.skipReason.send_failed')).toBeInTheDocument()
      expect(screen.getByText('interview.skippedAt:dt(2026-10-21T09:30:00Z)')).toBeInTheDocument()
    } finally {
      mockT.mockImplementation(((k: string) => k) as never)
    }
  })

  it('never shows the skip line when a session block exists', () => {
    render(<InterviewStatusCard interview={fullInterview()} skipReason="send_failed" skippedAt="2026-10-21T09:30:00Z" />)
    expect(screen.queryByText(/interview\.skipReason/)).toBeNull()
    expect(screen.queryByText(/interview\.skippedAt/)).toBeNull()
  })
})
