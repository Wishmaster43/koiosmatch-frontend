/**
 * KoiosFeedbackCard — the admin feedback overview card. All API calls mocked
 * (API-CREDITS-1, read-only reporting endpoint).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import KoiosFeedbackCard from './KoiosFeedbackCard'

const mockGetKoiosFeedback = vi.fn()
// The REAL koiosApi wrapper runs — the pin asserts the wire (route + param keys),
// not the wrapper's own arguments (§13 mutation-test canon).
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => mockGetKoiosFeedback(...args) },
  unwrap: (r: { data: { data?: unknown } }) => (r.data as { data?: unknown }).data ?? r.data,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const page1 = {
  summary: { total: 3, up: 2, down: 1, down_pct: 33.3, reasons: { inaccurate: 1, incomplete: 0, harmful: 0, tone: 0, other: 0 } },
  data: [
    {
      id: 'f1', surface: 'chat', rating: 'down', reasons: ['inaccurate'], comment: 'Wrong shift date',
      user: { id: 'u1', name: 'Danny' }, prompt_excerpt: 'What shifts run tomorrow?', created_at: '2026-08-20T10:15:00Z',
    },
    {
      id: 'f2', surface: 'generate', rating: 'up', reasons: [], comment: null,
      user: { id: 'u2', name: 'Anna' }, prompt_excerpt: null, created_at: '2026-08-21T09:00:00Z',
    },
  ],
  total: 2, per_page: 25, current_page: 1, last_page: 1,
}

beforeEach(() => { mockGetKoiosFeedback.mockReset() })

describe('KoiosFeedbackCard', () => {
  it('shows a loading state, then the summary and the row list', async () => {
    mockGetKoiosFeedback.mockResolvedValue({ data: { data: page1 } })
    render(<KoiosFeedbackCard />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('feedbackAdmin.summaryTitle')).toBeInTheDocument())

    // Pinned request: page + per_page params (§ request pin).
    expect(mockGetKoiosFeedback).toHaveBeenCalledWith('/ai/koios/feedback', { params: { page: 1, per_page: 25 } })

    // Summary totals rendered.
    expect(screen.getByText('koios.feedback.up')).toBeInTheDocument()
    expect(screen.getByText('koios.feedback.down')).toBeInTheDocument()

    // Reason chip for the one down-vote reason that actually occurred (rendered
    // both in the summary chip and the row's reason list — assert at least one).
    expect(screen.getAllByText(/koios\.feedback\.reasons\.inaccurate/).length).toBeGreaterThan(0)

    // Row content: excerpt + comment for the down row, empty-comment notice for the up row.
    expect(screen.getByText('What shifts run tomorrow?')).toBeInTheDocument()
    expect(screen.getByText('Wrong shift date')).toBeInTheDocument()
    expect(screen.getByText('feedbackAdmin.noComment')).toBeInTheDocument()
  })

  it('renders an empty state when there is no feedback yet', async () => {
    mockGetKoiosFeedback.mockResolvedValue({ summary: { total: 0, up: 0, down: 0, down_pct: 0, reasons: {} }, data: [], total: 0, per_page: 25, current_page: 1, last_page: 1 })
    render(<KoiosFeedbackCard />)
    await waitFor(() => expect(screen.getByText('feedbackAdmin.empty')).toBeInTheDocument())
  })

  it('renders an error state with a retry action on failure', async () => {
    mockGetKoiosFeedback.mockRejectedValue(new Error('boom'))
    render(<KoiosFeedbackCard />)
    await waitFor(() => expect(screen.getByText('feedbackAdmin.loadError')).toBeInTheDocument())
    expect(screen.getByText('feedbackAdmin.retry')).toBeInTheDocument()
  })
})
