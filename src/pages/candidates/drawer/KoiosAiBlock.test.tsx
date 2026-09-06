/**
 * KoiosAiBlock — S1 repair MUST-FIX 1: the "Advies vernieuwen" trigger is
 * gated on candidates.update AND the koios_ai module (EnsureTenantModule on
 * the backend route — a Core tenant with only koios_assist gets a 403). This
 * suite mocks the shared KoiosAdviceBlock so it can assert exactly which
 * props this host computes, without needing full i18n/date-format wiring.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import KoiosAiBlock from './KoiosAiBlock'
import type { Candidate } from '@/types/candidate'

const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

vi.mock('@/lib/useCandidateAdvice', () => ({ useCandidateAdvice: () => () => null }))
vi.mock('./candidateAiInsights', () => ({ buildCandidateAdviceInsights: () => [] }))
const mockRequest = vi.fn()
vi.mock('@/lib/useKoiosAdviceRun', () => ({
  useKoiosAdviceRun: () => ({ request: mockRequest, pending: false, notice: null, freshAdvice: undefined }),
}))
// Shallow-mock the shared block: render a marker for exactly the prop this
// suite cares about, so the assertion is about THIS host's wiring, not the
// block's own rendering (already covered by KoiosAdviceBlock.test.tsx).
vi.mock('@/components/ai/KoiosAdviceBlock', () => ({
  default: ({ onRequestAdvice }: { onRequestAdvice?: () => void }) => (
    <div data-testid="advice-block">{onRequestAdvice ? 'has-refresh' : 'no-refresh'}</div>
  ),
}))

const candidate = { id: 'c1', name: 'Jane Doe' } as unknown as Candidate

describe('KoiosAiBlock · module gate (S1 repair MUST-FIX 1)', () => {
  it('withholds onRequestAdvice when the tenant lacks the koios_ai module, even with candidates.update', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true, hasModule: () => false })
    render(<KoiosAiBlock c={candidate} />)
    expect(screen.getByTestId('advice-block')).toHaveTextContent('no-refresh')
  })

  it('withholds onRequestAdvice without candidates.update, even with the koios_ai module', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => false, hasModule: () => true })
    render(<KoiosAiBlock c={candidate} />)
    expect(screen.getByTestId('advice-block')).toHaveTextContent('no-refresh')
  })

  it('passes onRequestAdvice once both candidates.update AND koios_ai are granted', () => {
    mockUseAuth.mockReturnValue({ hasPermission: () => true, hasModule: () => true })
    render(<KoiosAiBlock c={candidate} />)
    expect(screen.getByTestId('advice-block')).toHaveTextContent('has-refresh')
  })
})
