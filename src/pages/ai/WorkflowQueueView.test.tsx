/**
 * WorkflowQueueView — WF-WACHTRIJ-FE-1: four UI states, the four sections from
 * a fixture, the "±" estimate label on retrying rows, and the deep-link into
 * the runs log (#details.runs?workflow_id=). Real i18next runtime (mirrors
 * WorkflowRelationsView.test.tsx) — assertions target real nl copy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
// Default-exported so the seeded-name test below can switch languages
// (LOOKUP-I18N-1, mirrors WorkflowListRow.test.tsx / WorkflowCard.test.tsx).
import i18n from '@/i18n'
import WorkflowQueueView from './WorkflowQueueView'
import api from '@/lib/api'

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

// Controllable page-access mock — the runs-log link must gate on details.runs
// (a role with AI agents but without Details would otherwise hit NoAccessPage).
const mockCanAccess = vi.hoisted(() => vi.fn<(page: string) => boolean>(() => true))
vi.mock('@/lib/access', () => ({ canAccessPage: (page: string) => mockCanAccess(page) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({}) }))

beforeEach(() => vi.clearAllMocks())

const FIXTURE = {
  pending: [{ run_id: 'r1', workflow_id: 'wf-1', workflow_name: 'Welcome flow', queued_at: '2026-08-24T08:00:00Z', trigger: 'event' }],
  waiting: [{ run_id: 'r2', workflow_id: 'wf-2', workflow_name: 'Reminder flow', queued_at: '2026-08-24T07:00:00Z', resume_at: '2026-08-25T08:00:00Z' }],
  scheduled: [{ workflow_id: 'wf-3', workflow_name: 'Daily sync', next_run_at: '2026-08-25T08:00:00Z', schedule_label: 'Dagelijks 08:00' }],
  retrying: [{ run_id: 'r4', workflow_id: 'wf-4', workflow_name: 'Match sync', attempts: 2, next_attempt_at: '2026-08-24T09:00:00Z', last_error: 'Timeout bij externe API' }],
  counts: { pending: 1, waiting: 1, scheduled_today: 1, retrying: 1 },
}

describe('WorkflowQueueView', () => {
  it('shows the loading state', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    render(<WorkflowQueueView />)
    expect(screen.getByText('Wachtrij ophalen…')).toBeInTheDocument()
  })

  it('shows the honest empty rest state when every list is empty', async () => {
    mockedGet.mockResolvedValue({ data: { pending: [], waiting: [], scheduled: [], retrying: [], counts: {} } })
    render(<WorkflowQueueView />)
    expect(await screen.findByText(/wachtrij is leeg/)).toBeInTheDocument()
  })

  it('shows an honest error (with retry) on a real failure', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500 } })
    render(<WorkflowQueueView />)
    expect(await screen.findByText('Wachtrij laden mislukt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Probeer opnieuw/ })).toBeInTheDocument()
  })

  it('degrades calmly on a 403 — an honest no-access note, no error banner', async () => {
    mockedGet.mockRejectedValue({ response: { status: 403 } })
    render(<WorkflowQueueView />)
    expect(await screen.findByText(/Je hebt geen toegang tot de wachtrij/)).toBeInTheDocument()
    expect(screen.queryByText('Wachtrij laden mislukt')).not.toBeInTheDocument()
  })

  it('renders all four sections from the fixture, with the "±" estimate on the retrying row', async () => {
    mockedGet.mockResolvedValue({ data: FIXTURE })
    render(<WorkflowQueueView />)
    expect(await screen.findByText('Welcome flow')).toBeInTheDocument()
    expect(screen.getByText('Reminder flow')).toBeInTheDocument()
    expect(screen.getByText('Daily sync')).toBeInTheDocument()
    expect(screen.getByText('Match sync')).toBeInTheDocument()
    expect(screen.getByText('Dagelijks 08:00', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Timeout bij externe API')).toBeInTheDocument()
    // next_attempt_at is a derived ESTIMATE — the "±" prefix says so.
    expect(screen.getByText(/±/)).toBeInTheDocument()
  })

  it('deep-links a pending run row into the runs log, pre-filtered on its workflow', async () => {
    mockedGet.mockResolvedValue({ data: FIXTURE })
    render(<WorkflowQueueView />)
    await screen.findByText('Welcome flow')
    // Pending/waiting/retrying rows each carry the "open runs" link; the
    // PENDING one (first rendered) belongs to wf-1.
    const links = screen.getAllByRole('link', { name: 'Open uitvoeringen' })
    expect(links[0]).toHaveAttribute('href', '#details.runs?workflow_id=wf-1')
  })
})

// Fix-round pins (Opus B1-B2): measured trigger vocabulary + the gated runs-link.
describe('WorkflowQueueView — fix-round pins', () => {
  it('translates the scheduled trigger — the raw wire value never renders', async () => {
    mockedGet.mockResolvedValue({ data: { data: {
      pending: [{ run_id: 'r1', workflow_id: 'wf-1', workflow_name: 'Wekelijkse mail', queued_at: '2026-08-24T10:00:00Z', trigger: 'scheduled' }],
      waiting: [], scheduled: [], retrying: [], counts: { pending: 1 },
    } } })
    render(<WorkflowQueueView />)
    // Real (nl) i18n: the vocabulary entry renders, the raw wire value never.
    expect((await screen.findAllByText(/Gepland/)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/·\s*scheduled/)).not.toBeInTheDocument()
  })

  it('hides the runs-log link for a role without details-access — no fake affordance', async () => {
    mockCanAccess.mockReturnValue(false)
    mockedGet.mockResolvedValue({ data: { data: {
      pending: [{ run_id: 'r1', workflow_id: 'wf-1', workflow_name: 'Wekelijkse mail', queued_at: '2026-08-24T10:00:00Z', trigger: 'event' }],
      waiting: [], scheduled: [], retrying: [], counts: { pending: 1 },
    } } })
    render(<WorkflowQueueView />)
    await screen.findByText('Wekelijkse mail')
    expect(screen.queryByRole('link', { name: 'queue.openRuns' })).not.toBeInTheDocument()
    mockCanAccess.mockReturnValue(true)
  })
})

// LOOKUP-I18N-1 (round 2 pin): a queue row's workflow_name is the same seeded
// default a seeded workflow carries in the list/card views — the exact defect
// measured live 25-08 ('Leads-telling vacatures' rendering raw under Scheduled).
describe('WorkflowQueueView · seeded workflow name i18n (LOOKUP-I18N-1)', () => {
  it('renders a seeded workflow name in English when the UI language is English', async () => {
    await i18n.changeLanguage('en')
    mockedGet.mockResolvedValue({ data: {
      pending: [], waiting: [],
      scheduled: [{ workflow_id: 'wf-5', workflow_name: 'Leads-telling vacatures', next_run_at: '2026-08-26T08:00:00Z' }],
      retrying: [], counts: { scheduled_today: 1 },
    } })
    const { unmount } = render(<WorkflowQueueView />)
    expect(await screen.findByText('Vacancy lead count')).toBeInTheDocument()
    expect(screen.queryByText('Leads-telling vacatures')).not.toBeInTheDocument()
    // Unmount before switching back — resetting the language on a still-mounted
    // component would fire a state update outside act().
    unmount()
    await i18n.changeLanguage('nl')
  })

  it('leaves a tenant-renamed workflow name untouched under English', async () => {
    await i18n.changeLanguage('en')
    mockedGet.mockResolvedValue({ data: {
      pending: [], waiting: [],
      scheduled: [{ workflow_id: 'wf-6', workflow_name: 'Weekly customer digest', next_run_at: '2026-08-26T08:00:00Z' }],
      retrying: [], counts: { scheduled_today: 1 },
    } })
    const { unmount } = render(<WorkflowQueueView />)
    expect(await screen.findByText('Weekly customer digest')).toBeInTheDocument()
    unmount()
    await i18n.changeLanguage('nl')
  })
})
