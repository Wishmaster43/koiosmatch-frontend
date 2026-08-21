/**
 * MatchScoreSection — Danny 21-08 ruling 1: the retired ApplicationStatusStrip
 * match-score cell's two affordances (manual override PATCH, recalculate POST)
 * moved here verbatim (§3 no lost affordance), plus showOverall being back to
 * true now that the strip no longer duplicates the number. Request-shape
 * coverage (method/route/body, §13) mirrors the tests the old cell carried.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchScoreSection from './MatchScoreSection'
import type { ApplicationDetail } from '@/types/application'

// Key-echo (repo-wide precedent) — honours defaultValue like the real t() does.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}))

const mockUseAuth = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
// `unwrap` mirrors the real implementation (data → data.data) so the assertions
// exercise the same envelope handling the app does.
vi.mock('@/lib/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args), patch: (...args: unknown[]) => mockPatch(...args) },
  unwrap: (res: unknown) => {
    const body = (res as { data?: unknown })?.data ?? res
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) return (body as { data: unknown }).data
    return body
  },
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => mockNotifySuccess(...a), notifyError: (...a: unknown[]) => mockNotifyError(...a) }))

const app = (over: Partial<ApplicationDetail> = {}) => ({
  id: 1, score: null, matchCriteria: [], matchSummary: '',
  matchSource: 'ai', aiScore: null,
  ...over,
} as unknown as ApplicationDetail)

beforeEach(() => {
  vi.resetAllMocks()
  mockUseAuth.mockReturnValue({ hasPermission: () => true })
})

describe('MatchScoreSection · showOverall restored (Danny 21-08 ruling 1)', () => {
  it('shows the overall percentage once the strip no longer duplicates it', () => {
    render(<MatchScoreSection application={app({ score: 82 })} />)
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('shows the honest placeholder when there is no score yet', () => {
    render(<MatchScoreSection application={app({ score: null })} />)
    expect(screen.getByText('matchScore.detailsSoon')).toBeInTheDocument()
    // The recalculate trigger must still be there — a never-scored application
    // can still be scored from this title row (§3 no lost affordance).
    expect(screen.getByRole('button', { name: 'status.recalculateScore' })).toBeInTheDocument()
  })
})

describe('MatchScoreSection · recalculate score (W29, moved from the retired strip cell)', () => {
  it('POSTs /applications/{id}/score and renders the fresh percentage from the response', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 91 } } })
    render(<MatchScoreSection application={app({ score: 40 })} />)
    expect(screen.getByText('40%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'status.recalculateScore' }))
    expect(mockPost).toHaveBeenCalledWith('/applications/1/score')
    await waitFor(() => expect(screen.getByText('91%')).toBeInTheDocument())
    expect(screen.queryByText('40%')).toBeNull()
    expect(mockNotifySuccess).toHaveBeenCalledWith('status.recalculateDone')
  })

  it('hides the recalculate trigger entirely without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<MatchScoreSection application={app({ score: 40 })} />)
    expect(screen.queryByRole('button', { name: 'status.recalculateScore' })).toBeNull()
  })

  it('checks the same permission string the route middleware requires', () => {
    const hasPermission = vi.fn().mockReturnValue(true)
    mockUseAuth.mockReturnValue({ hasPermission })
    render(<MatchScoreSection application={app({ score: 40 })} />)
    expect(hasPermission).toHaveBeenCalledWith('applications.update')
  })

  it('surfaces a failed recalculation via extractApiError and keeps the trigger retryable', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 500, data: { message: 'Scoring engine unavailable' } } })
    render(<MatchScoreSection application={app({ score: 40 })} />)
    const btn = screen.getByRole('button', { name: 'status.recalculateScore' })
    await userEvent.click(btn)
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Scoring engine unavailable'))
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('drops the locally recalculated score once a fresher score prop arrives (fresh prop wins)', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 91 } } })
    const { rerender } = render(<MatchScoreSection application={app({ score: 40 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.recalculateScore' }))
    await waitFor(() => expect(screen.getByText('91%')).toBeInTheDocument())
    rerender(<MatchScoreSection application={app({ score: 60 })} />)
    await waitFor(() => expect(screen.getByText('60%')).toBeInTheDocument())
    expect(screen.queryByText('91%')).toBeNull()
  })
})

// MATCHSCORE-EDIT-1: the quick manual-override pencil, moved verbatim from the
// retired strip cell. Its Save/Cancel carry their OWN override labels (not
// matchScore.save/cancel) so they never collide with MatchScoreBlock's OWN
// criteria-slider edit buttons, which share the title row.
describe('MatchScoreSection · manual score override (MATCHSCORE-EDIT-1, moved from the retired strip cell)', () => {
  it('PATCHes /applications/{id} with the integer match_score and shows the manual note', async () => {
    mockPatch.mockResolvedValueOnce({ data: { data: { id: 1, match_score: 72, match_score_source: 'manual', ai_match_score: 39 } } })
    render(<MatchScoreSection application={app({ score: 39, matchSource: 'ai', aiScore: 39 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '72')
    await userEvent.click(screen.getByRole('button', { name: 'matchScore.saveOverride' }))
    // The REQUEST — method, route and the body it carries (§13).
    expect(mockPatch).toHaveBeenCalledWith('/applications/1', { match_score: 72 })
    await waitFor(() => expect(screen.getByText('72%')).toBeInTheDocument())
    expect(screen.getByText('matchScore.manualNote')).toBeInTheDocument()
    expect(mockNotifySuccess).toHaveBeenCalledWith('status.scoreSaved')
  })

  it('blocks an out-of-range value client-side — no PATCH fires', async () => {
    render(<MatchScoreSection application={app({ score: 50 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '101')
    const saveBtn = screen.getByRole('button', { name: 'matchScore.saveOverride' })
    expect(saveBtn).toBeDisabled()
    await userEvent.click(saveBtn)
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('cancels the edit without firing a PATCH, restoring the original score', async () => {
    render(<MatchScoreSection application={app({ score: 50 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '10')
    await userEvent.click(screen.getByRole('button', { name: 'matchScore.cancelOverride' }))
    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('hides the edit pencil entirely without applications.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false })
    render(<MatchScoreSection application={app({ score: 40 })} />)
    expect(screen.queryByRole('button', { name: 'status.editScore' })).toBeNull()
  })

  it('surfaces a failed manual save via extractApiError and keeps editing retryable', async () => {
    mockPatch.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Invalid match score' } } })
    render(<MatchScoreSection application={app({ score: 40 })} />)
    await userEvent.click(screen.getByRole('button', { name: 'status.editScore' }))
    const input = screen.getByRole('spinbutton', { name: 'status.matchScore' })
    await userEvent.clear(input)
    await userEvent.type(input, '80')
    await userEvent.click(screen.getByRole('button', { name: 'matchScore.saveOverride' }))
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Invalid match score'))
    expect(screen.getByRole('spinbutton', { name: 'status.matchScore' })).toHaveValue(80)
  })
})

// DD-FE-9: MatchScoreBlock's OWN criteria-slider edit (a SEPARATE affordance
// from the quick pencil above) still saves via onAdjustScore, unchanged.
describe('MatchScoreSection · MatchScoreBlock\'s own criteria edit stays wired', () => {
  it('saves the adjusted score via onAdjustScore, same payload shape as before the move', async () => {
    const onAdjustScore = vi.fn()
    const user = userEvent.setup()
    render(<MatchScoreSection application={app({ id: 3, score: 75, matchCriteria: [{ key: 'c1', label: 'Skills', score: 80, weight: 1 }] })} onAdjustScore={onAdjustScore} />)
    await user.click(screen.getByTitle('matchScore.edit'))
    await user.click(screen.getByTitle('matchScore.save'))
    expect(onAdjustScore).toHaveBeenCalledWith(3, { score: 80, criteria: [{ key: 'c1', label: 'Skills', score: 80, weight: 1 }] })
  })
})
