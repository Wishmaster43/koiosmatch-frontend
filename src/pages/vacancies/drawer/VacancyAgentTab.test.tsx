/**
 * VacancyAgentTab · VAC-AGENT-2 (Danny 21-07): the agent picker + the read-only
 * interview flow the linked agent carries, now on its own tab (moved out of
 * DetailsTab). Rendered with the REAL useVacancyRecord (not a stubbed onUpdate) so
 * the PATCH mapping (buildVacancyPatch → ai_agent_id) is genuinely exercised, not
 * asserted against a mock. `api` is mocked; GET /vacancies/{id} and GET /ai/agents
 * are routed by URL.
 *
 * Unlike sibling tab tests (e.g. MatchingTab.test.tsx), assertions here use the
 * REAL nl copy, not the raw t() key: this component pulls in InterviewFlowSection
 * → shared.tsx → lib/datetime → '../i18n', and that module's import.meta.glob
 * side-effect-initialises the real i18next singleton (default lng 'nl') the first
 * time anything in that chain is imported — mirrors AgentForm.test.tsx, which hits
 * the same chain and asserts real Dutch strings ('Opslaan', 'Openingstijden').
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import VacancyAgentTab from './VacancyAgentTab'
import { useVacancyRecord } from '../hooks/useVacancyRecord'
import api from '@/lib/api'
import type { Vacancy } from '@/types/vacancy'
import type { AiAgent } from '@/types/ai'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }
})
// INTERVIEW-BACKFILL-1: assert the real toast text, not just that a callback fired.
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))

const mockGet   = api.get   as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const mockPost  = api.post  as unknown as ReturnType<typeof vi.fn>

// One agent shaped like the real GET /ai/agents response (mirrors
// AIManagementTabs.test.tsx), carrying an interview flow so the read-only
// InterviewFlowSection has something to render.
const mockAgent: AiAgent = {
  id: 'a1',
  name: 'Kelly',
  interview_flow: {
    id: 'f1', name: 'Zorgintake (9 stappen)', active: true,
    intro_template: 'Hoi {{first_name}}!',
    system_prompt: 'Je bent Kelly, recruiter bij Yesway...',
    statuses: ['INTRO_SENT', 'COMPLETED'],
    output_fields: { first_name: 'string' },
  },
}

// Raw (API-shaped) vacancy detail — mapVacancyDetail is defensive, so only the
// ai_agent field under test needs to be populated.
const rawDetail = (over: Record<string, unknown> = {}) => ({
  id: 'v1', title: 'Verpleegkundige', ai_agent: null,
  ...over,
})
const vacancyRow = { id: 'v1', title: 'Verpleegkundige' } as Vacancy

// Real nl copy (see the file doc comment on why this isn't the raw t() key).
const PLACEHOLDER = 'Selecteer een AI-agent'
const NONE = 'Geen agent'
const LOAD_ERROR = 'AI-agenten laden is mislukt.'
const FLOW_HINT = 'Koppel een agent om het interview te zien.'

// Harness: mounts the REAL useVacancyRecord + VacancyAgentTab together, so
// `onUpdate` exercises the actual PATCH-mapping wiring end to end. VacancyAgentTab
// calls the real useAiAgents (react-query), so this needs a QueryClientProvider —
// retry disabled so the load-error test doesn't sit through retry backoff.
function Harness() {
  const [, setVacancies] = useState<Vacancy[]>([vacancyRow])
  const [, setTotal] = useState(1)
  const record = useVacancyRecord({
    setVacancies, setTotal, statusMeta: () => ({ label: '', color: '' }),
    users: [], customers: [], t: ((k: string) => k) as unknown as TFunction,
  })
  // Auto-select on mount — fetches the detail via the mocked GET.
  useEffect(() => { record.selectVacancy(vacancyRow) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!record.detail) return <div>loading-detail</div>
  return <VacancyAgentTab vacancy={record.detail} onUpdate={record.updateVacancy} />
}

const renderHarness = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><Harness /></QueryClientProvider>)
}

// Route GET by url — the vacancy detail vs. the /ai/agents list (real GET /ai/agents
// returns a bare array, per unwrapList's array branch — see AIManagementTabs.test.tsx).
const routeGet = (detail: Record<string, unknown>, agents: unknown[] = [mockAgent]) =>
  (url: string) => {
    if (url === '/vacancies/v1') return Promise.resolve({ data: { data: detail } })
    if (url === '/ai/agents') return Promise.resolve({ data: agents })
    return Promise.resolve({ data: [] })
  }

beforeEach(() => { mockGet.mockReset(); mockPatch.mockReset(); mockPost.mockReset(); mockNotifySuccess.mockReset(); mockNotifyError.mockReset() })

describe('VacancyAgentTab · picker → PATCH ai_agent_id + read-only interview flow', () => {
  it('links an agent: PATCHes ai_agent_id and then shows the interview flow it carries', async () => {
    mockGet.mockImplementation(routeGet(rawDetail()))
    renderHarness()
    // Wait for the /ai/agents fetch to resolve (placeholder replaces the loading text).
    await waitFor(() => screen.getByRole('button', { name: PLACEHOLDER }))
    // No agent linked yet — the design-only hint shows, not the flow.
    expect(screen.getByText(FLOW_HINT)).toBeInTheDocument()

    mockPatch.mockResolvedValue({ data: { data: rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } }) } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: PLACEHOLDER }))
    await user.click(screen.getByRole('button', { name: 'Kelly' }))

    // buildVacancyPatch maps aiAgentId → ai_agent_id (VAC-AGENT-1 contract).
    expect(mockPatch).toHaveBeenCalledWith('/vacancies/v1', { ai_agent_id: 'a1' })

    // Once linked, the agent's own interview flow renders read-only.
    await waitFor(() => expect(screen.getByText('Zorgintake (9 stappen)')).toBeInTheDocument())
  })

  it('unlinking (clearing to none) sends ai_agent_id: null and the flow hint returns', async () => {
    mockGet.mockImplementation(routeGet(rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } })))
    renderHarness()
    await waitFor(() => expect(screen.getByText('Zorgintake (9 stappen)')).toBeInTheDocument())

    mockPatch.mockResolvedValue({ data: { data: rawDetail({ ai_agent: null }) } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Kelly' }))
    await user.click(screen.getByRole('button', { name: NONE }))

    // Clearing sends null, never an empty-string id (no separate "ontkoppelen" field).
    expect(mockPatch).toHaveBeenCalledWith('/vacancies/v1', { ai_agent_id: null })
    await waitFor(() => expect(screen.getByText(FLOW_HINT)).toBeInTheDocument())
  })

  it('shows a load error alongside the currently-linked agent name when GET /ai/agents fails', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/vacancies/v1') return Promise.resolve({ data: { data: rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } }) } })
      if (url === '/ai/agents') return Promise.reject(new Error('boom'))
      return Promise.resolve({ data: [] })
    })
    renderHarness()
    await waitFor(() => screen.getByText(LOAD_ERROR))
    // The currently-linked name still shows even though the fresh list failed.
    expect(screen.getByText('Kelly')).toBeInTheDocument()
  })
})

// INTERVIEW-BACKFILL-1 (now LIVE, contract-complete 22-07): the "start
// interview for existing applicants" action — only visible once an agent is
// linked, always confirmed first (AVG: never auto-fires, this sends WhatsApp
// messages), honest-gated on a 404 safety net, and — per the confirmed
// `{ started, skipped:[{application_id, reason}], eligible_total }` contract —
// its result toast now reads "X of Y started" (Y = eligible_total, i.e. only
// LIVE-stage applications) plus a translated reason breakdown when rows were skipped.
const BACKFILL_BUTTON = 'Interview starten voor bestaande sollicitanten'

describe('VacancyAgentTab · backfill existing applicants (INTERVIEW-BACKFILL-1)', () => {
  it('does not render the backfill action when no agent is linked', async () => {
    mockGet.mockImplementation(routeGet(rawDetail()))
    renderHarness()
    await waitFor(() => screen.getByText(FLOW_HINT))
    expect(screen.queryByRole('button', { name: BACKFILL_BUTTON })).toBeNull()
  })

  it('confirms with the generic message when the vacancy carries no applicant count, then POSTs and toasts against eligible_total (no skips)', async () => {
    mockGet.mockImplementation(routeGet(rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } })))
    renderHarness()
    await waitFor(() => screen.getByText('Zorgintake (9 stappen)'))

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: BACKFILL_BUTTON }))
    expect(screen.getByText(/Dit stuurt WhatsApp-berichten\.$/)).toBeInTheDocument()

    mockPost.mockResolvedValueOnce({ data: { data: { started: 3, skipped: [], eligible_total: 3 } } })
    await user.click(screen.getByRole('button', { name: 'Bevestigen' }))

    expect(mockPost).toHaveBeenCalledWith('/vacancies/v1/start-interviews')
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('3 van 3 gestart.'))
  })

  it('groups skipped rows by reason and includes the translated breakdown in the toast', async () => {
    mockGet.mockImplementation(routeGet(rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } })))
    renderHarness()
    await waitFor(() => screen.getByText('Zorgintake (9 stappen)'))

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: BACKFILL_BUTTON }))
    // 2 applicants skipped for missing WhatsApp consent, 1 because a session already runs.
    mockPost.mockResolvedValueOnce({ data: { data: {
      started: 2, eligible_total: 5,
      skipped: [
        { application_id: 'app-1', reason: 'no_mobile_or_consent' },
        { application_id: 'app-2', reason: 'no_mobile_or_consent' },
        { application_id: 'app-3', reason: 'already_has_session' },
      ],
    } } })
    await user.click(screen.getByRole('button', { name: 'Bevestigen' }))

    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith(
      '2 van 5 gestart — 3 overgeslagen: 2 geen WhatsApp-toestemming, 1 loopt al.',
    ))
  })

  it('buckets an unrecognised skip reason under the generic "unknown error" label', async () => {
    mockGet.mockImplementation(routeGet(rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } })))
    renderHarness()
    await waitFor(() => screen.getByText('Zorgintake (9 stappen)'))

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: BACKFILL_BUTTON }))
    mockPost.mockResolvedValueOnce({ data: { data: {
      started: 1, eligible_total: 2,
      skipped: [{ application_id: 'app-9', reason: 'some_future_reason' }],
    } } })
    await user.click(screen.getByRole('button', { name: 'Bevestigen' }))

    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith(
      '1 van 2 gestart — 1 overgeslagen: 1 onbekende fout.',
    ))
  })

  it('confirms with the applicant COUNT in the message when the vacancy carries one', async () => {
    mockGet.mockImplementation(routeGet(rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' }, applications_count: 3 })))
    renderHarness()
    await waitFor(() => screen.getByText('Zorgintake (9 stappen)'))
    await userEvent.click(screen.getByRole('button', { name: BACKFILL_BUTTON }))
    expect(screen.getByText(/^3 bestaande sollicitanten van deze vacature/)).toBeInTheDocument()
  })

  it('cancelling the confirm dialog never calls the API', async () => {
    mockGet.mockImplementation(routeGet(rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } })))
    renderHarness()
    await waitFor(() => screen.getByText('Zorgintake (9 stappen)'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: BACKFILL_BUTTON }))
    await user.click(screen.getByRole('button', { name: 'Annuleren' }))
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('honest-gates a 404 (route not shipped yet): disables the button and shows the calm notice', async () => {
    mockGet.mockImplementation(routeGet(rawDetail({ ai_agent: { id: 'a1', name: 'Kelly' } })))
    renderHarness()
    await waitFor(() => screen.getByText('Zorgintake (9 stappen)'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: BACKFILL_BUTTON }))
    mockPost.mockRejectedValueOnce({ response: { status: 404 } })
    await user.click(screen.getByRole('button', { name: 'Bevestigen' }))

    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Interview starten voor bestaande sollicitanten is nog niet beschikbaar — wacht op de backend-koppeling.'))
    expect(screen.getByRole('button', { name: BACKFILL_BUTTON })).toBeDisabled()
  })
})
