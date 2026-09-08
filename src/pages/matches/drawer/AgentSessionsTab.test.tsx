/**
 * AgentSessionsTab — four UI states, viaCandidate subhead, pause/resume controls
 * with ConfirmDialog and POST requests, authorization gating on page.whatsapp.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { MatchRow } from '@/types/match'

const { mockPost, mockUseMatchAgentSessions, mockUseAgentSessionControl, mockUseAuth } = vi.hoisted(() => {
  const mockPost = vi.fn()
  const mockUseMatchAgentSessions = vi.fn()
  const mockUseAgentSessionControl = vi.fn()
  const mockUseAuth = vi.fn()
  return { mockPost, mockUseMatchAgentSessions, mockUseAgentSessionControl, mockUseAuth }
})

vi.mock('@/lib/api', () => ({
  default: {
    post: mockPost,
  },
}))

vi.mock('@/lib/notify', () => ({
  notifyError: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

vi.mock('../hooks/useMatchAgentSessions', () => ({
  useMatchAgentSessions: mockUseMatchAgentSessions,
}))

vi.mock('@/pages/applications/shared', () => ({
  InterviewStatusCard: ({ interview }: { interview: { category?: string } }) => (
    <div data-testid="interview-card">{interview?.category || 'none'}</div>
  ),
}))

vi.mock('@/hooks/useAgentSessionControl', () => ({
  useAgentSessionControl: mockUseAgentSessionControl,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

import AgentSessionsTab from './AgentSessionsTab'

const mockMatch: MatchRow = {
  id: 'm1',
  candidate: 'John Doe',
  initials: 'JD',
  vacancy: 'Developer',
  client: 'ACME',
  candidateId: 'c1',
  vacancyId: 'v1',
  clientId: 'cl1',
  score: 85,
  stage: 'hired',
  stageColor: 'var(--color-success)',
  status: 'active',
  owner: 'Jane',
  ownerId: 'u1',
  ownerInitials: 'J',
  ownerColor: 'var(--color-danger)',
  date: '2026-09-01',
  helloflexLink: null,
  shiftmanagerLink: null,
  koiosAiAdvice: null,
  applicationId: undefined,
}

const mockMatchWithApplication: MatchRow = {
  ...mockMatch,
  applicationId: 'a1',
}

describe('AgentSessionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      hasPermission: (p: string) => p === 'page.whatsapp',
    })
    mockUseAgentSessionControl.mockReturnValue({
      busy: null,
      run: vi.fn(),
    })
  })

  it('renders loading state', () => {
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [],
      loading: true,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    expect(screen.getByText('agentSessions.loading')).toBeInTheDocument()
  })

  it('renders error state', () => {
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [],
      loading: false,
      error: new Error('Network error'),
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    expect(screen.getByText('agentSessions.loadError')).toBeInTheDocument()
  })

  it('renders empty state', () => {
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [],
      loading: false,
      error: null,
      empty: true,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    expect(screen.getByText('agentSessions.empty')).toBeInTheDocument()
  })

  it('shows viaCandidate subhead for direct match (no applicationId)', () => {
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [
        { interview: { category: 'busy' }, conversationId: 'c1' },
      ],
      loading: false,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    expect(screen.getByText('agentSessions.viaCandidate')).toBeInTheDocument()
  })

  it('does not show viaCandidate subhead when applicationId is set', () => {
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [
        { interview: { category: 'busy' }, conversationId: 'c1' },
      ],
      loading: false,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatchWithApplication} />)
    expect(screen.queryByText('agentSessions.viaCandidate')).not.toBeInTheDocument()
  })

  it('renders one card per session', () => {
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [
        { interview: { category: 'busy' }, conversationId: 'c1' },
        { interview: { category: 'paused' }, conversationId: 'c2' },
      ],
      loading: false,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    const cards = screen.getAllByTestId('interview-card')
    expect(cards).toHaveLength(2)
  })

  it('pause button opens ConfirmDialog and POSTs on confirm', async () => {
    const runMock = vi.fn().mockResolvedValue({})
    mockUseAgentSessionControl.mockReturnValue({
      busy: null,
      run: runMock,
    })
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [
        { interview: { category: 'busy' }, conversationId: 'c1' },
      ],
      loading: false,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    const pauseBtn = screen.getByRole('button', { name: /agentSessions.pause/i })
    fireEvent.click(pauseBtn)
    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /agentSessions.pauseConfirmAction/i })
      expect(confirmBtn).toBeInTheDocument()
      fireEvent.click(confirmBtn)
    })
    await waitFor(() => {
      expect(runMock).toHaveBeenCalledWith('c1', 'pause')
    })
  })

  it('resume button POSTs directly without dialog', async () => {
    const runMock = vi.fn().mockResolvedValue({})
    mockUseAgentSessionControl.mockReturnValue({
      busy: null,
      run: runMock,
    })
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [
        { interview: { category: 'paused' }, conversationId: 'c1' },
      ],
      loading: false,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    const resumeBtn = screen.getByRole('button', { name: /agentSessions.resume/i })
    fireEvent.click(resumeBtn)
    await waitFor(() => {
      expect(runMock).toHaveBeenCalledWith('c1', 'resume')
    })
  })

  it('does not render controls when page.whatsapp permission is missing', () => {
    mockUseAuth.mockReturnValue({
      hasPermission: () => false,
    })
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [
        { interview: { category: 'busy' }, conversationId: 'c1' },
      ],
      loading: false,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    expect(screen.queryByRole('button', { name: /agentSessions.pause/i })).not.toBeInTheDocument()
  })

  it('does not render controls when conversationId is null', () => {
    mockUseMatchAgentSessions.mockReturnValue({
      sessions: [
        { interview: { category: 'busy' }, conversationId: null },
      ],
      loading: false,
      error: null,
      empty: false,
      refetch: vi.fn(),
    })
    render(<AgentSessionsTab match={mockMatch} />)
    expect(screen.queryByRole('button', { name: /agentSessions.pause/i })).not.toBeInTheDocument()
  })
})
