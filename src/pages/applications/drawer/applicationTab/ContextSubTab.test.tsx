/**
 * ContextSubTab — V-appdetail-4: the motivation letter's read-only expand.
 * Long letters collapse under a maxHeight with a show more/less toggle; short
 * ones render fully with no toggle at all (§3, no fake affordance on a letter
 * that never overflowed).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ContextSubTab from './ContextSubTab'
import type { ApplicationDetail } from '@/types/application'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v }) }))
vi.mock('../CompetitionBlock', () => ({ default: () => null }))
vi.mock('@/components/ai/KoiosAdviceBlock', () => ({ default: () => null }))
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
