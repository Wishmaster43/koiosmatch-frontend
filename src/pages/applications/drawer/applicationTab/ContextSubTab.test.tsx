/**
 * ContextSubTab — V-appdetail-4: the motivation letter's read-only expand.
 * Long letters collapse under a maxHeight with a show more/less toggle; short
 * ones render fully with no toggle at all (§3, no fake affordance on a letter
 * that never overflowed).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import ContextSubTab from './ContextSubTab'
import { useApplicationAdvice } from '@/lib/useApplicationAdvice'
import type { ApplicationDetail } from '@/types/application'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v }) }))
vi.mock('../CompetitionBlock', () => ({ default: () => null }))
// The advice-block WIRING is under test (KOIOS-ADVIES-OVERAL-1), not its chrome —
// the stub exposes each insight's collapsed label as plain text (no buttons, so
// the motivation tests' queryByRole('button') stays meaningful).
vi.mock('@/components/ai/KoiosAdviceBlock', () => ({
  default: ({ insights }: { insights: { type: string }[] }) => (
    <div data-testid="koios-advice">{insights.map((i, idx) => <span key={idx}>{i.type}</span>)}</div>
  ),
}))
vi.mock('@/components/ui/SafeHtml', () => ({ default: ({ html }: { html: string }) => <div data-testid="safe-html">{html}</div> }))

const base = { id: 'a1' } as unknown as ApplicationDetail

describe('ContextSubTab · motivation letter expand', () => {
  it('renders a short letter fully with no expand toggle', () => {
    render(<ContextSubTab application={{ ...base, coverLetter: '<p>Korte motivatie.</p>' } as ApplicationDetail} />)
    expect(screen.getByTestId('safe-html')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('collapses a long letter behind a show-more toggle that expands it', () => {
    const long = `<p>${'x'.repeat(500)}</p>`
    render(<ContextSubTab application={{ ...base, coverLetter: long } as ApplicationDetail} />)
    const toggle = screen.getByRole('button')
    expect(toggle).toHaveTextContent('motivation.showMore')
    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent('motivation.showLess')
  })
})

// KOIOS-ADVIES-OVERAL-1: the drawer block shows EXACTLY the advice the table's
// Koios column derives — asserted through the SAME resolver (useApplicationAdvice),
// never a copied literal.
describe('ContextSubTab · table-identical Koios advice (KOIOS-ADVIES-OVERAL-1)', () => {
  it('shows the same label the table pill derives when the application carries an AI task', () => {
    const withTask = { ...base, task: 'Bel de kandidaat terug' } as ApplicationDetail
    const { result } = renderHook(() => useApplicationAdvice())
    const expected = result.current(withTask)?.label
    expect(expected).toBeTruthy()
    render(<ContextSubTab application={withTask} />)
    expect(screen.getByTestId('koios-advice')).toHaveTextContent(expected as string)
  })

  it('renders no advice row on a clean application (resolver returns null)', () => {
    const { result } = renderHook(() => useApplicationAdvice())
    expect(result.current(base)).toBeNull()
    render(<ContextSubTab application={base} />)
    // The heuristic rows still render, and the FIRST row is the progress
    // heuristic — nothing was prepended for the absent advice (no empty shell).
    const rows = screen.getByTestId('koios-advice').querySelectorAll('span')
    expect(rows[0]).toHaveTextContent('ai.progressLabel')
  })
})
