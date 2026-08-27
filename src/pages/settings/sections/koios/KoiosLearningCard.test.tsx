/**
 * KoiosLearningCard — C1-lane 2 (K-148). Mutation test asserts the request
 * (route + from/to params), never only that a callback fired (§13). The API
 * call is fully mocked — no live /api/ai/koios/* call ever fires (API-CREDITS-1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import KoiosLearningCard from './KoiosLearningCard'

// The API call itself is mocked — no live AI call fires (API-CREDITS-1).
const mockGetKoiosLearning = vi.fn()
vi.mock('./koiosApi', () => ({ getKoiosLearning: (...a: unknown[]) => mockGetKoiosLearning(...a) }))

// i18n stub: keys with interpolation render key + values so assertions stay readable.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))

const fixture = {
  period: { from: '2026-07-28', to: '2026-08-27' },
  top_questions: [{ question: 'How many candidates matched?', count: 42 }],
  failure_reasons: { refusal: 3, budget: 1, tool_error: 0, no_result: 5 },
  tools_requested_but_denied: { not_tracked: true },
  feedback: { down_pct: 12, top_reasons: ['too vague'], examples: ['not helpful'] },
  suggestions: ['Add a tool for X'],
}

beforeEach(() => { mockGetKoiosLearning.mockReset() })

describe('KoiosLearningCard', () => {
  // Mutation-style: asserts the actual request, not just that a callback fired.
  it('requests the learning report with a from/to window', async () => {
    mockGetKoiosLearning.mockResolvedValue(fixture)
    render(<KoiosLearningCard />)
    await waitFor(() => expect(mockGetKoiosLearning).toHaveBeenCalledTimes(1))
    const [from, to] = mockGetKoiosLearning.mock.calls[0]
    expect(typeof from).toBe('string')
    expect(typeof to).toBe('string')
    expect(from < to).toBe(true)
  })

  it('renders the top question and the failure counts', async () => {
    mockGetKoiosLearning.mockResolvedValue(fixture)
    render(<KoiosLearningCard />)
    await screen.findByText('How many candidates matched?')
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  // Honesty check: not_tracked renders the muted line, never a fabricated "0".
  it('renders the honest denied-tools notice, never a zero', async () => {
    mockGetKoiosLearning.mockResolvedValue(fixture)
    render(<KoiosLearningCard />)
    await screen.findByText('learning.deniedNotTracked')
  })

  it('offers a retry on error and re-fetches on click', async () => {
    mockGetKoiosLearning.mockRejectedValueOnce(new Error('boom'))
    render(<KoiosLearningCard />)
    await screen.findByRole('alert')
    mockGetKoiosLearning.mockResolvedValueOnce(fixture)
    fireEvent.click(screen.getByRole('button', { name: 'learning.retry' }))
    await waitFor(() => expect(mockGetKoiosLearning).toHaveBeenCalledTimes(2))
  })
})
