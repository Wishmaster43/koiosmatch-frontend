/**
 * ProductivityByRecruiterBars — renders per-recruiter bars and navigates to
 * that recruiter's candidates on a bar click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ProductivityByRecruiterBars from './ProductivityByRecruiterBars'
import type { ProductivityByRecruiterRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

let capturedOnBarClick: ((row: unknown) => void) | undefined
vi.mock('@/components/charts/WeeklyBarChartCard', () => ({
  default: (props: { onBarClick?: (row: unknown) => void }) => { capturedOnBarClick = props.onBarClick; return <div data-testid="bars" /> },
}))

const row: ProductivityByRecruiterRow = { user_id: 'u1', name: 'Anna', proposals: 12, placements: 3 }

describe('ProductivityByRecruiterBars', () => {
  it('self-hides on an empty feed', () => {
    const { container } = render(<ProductivityByRecruiterBars rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('navigates to the clicked recruiter\'s candidates', () => {
    const onNavigate = vi.fn()
    render(<ProductivityByRecruiterBars rows={[row]} onNavigate={onNavigate} />)
    capturedOnBarClick?.({ userId: 'u1' })
    expect(onNavigate).toHaveBeenCalledWith('candidates', { owner: 'u1' })
  })
})
