/**
 * RecruiterLoad — K-173 fase 6: self-hides on an empty feed (mirrors the shared
 * WidgetListBlock convention), otherwise one row per recruiter in server order.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecruiterLoad from './RecruiterLoad'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('RecruiterLoad', () => {
  it('renders nothing when the feed is empty (absent from an older/other-role server)', () => {
    const { container } = render(<RecruiterLoad rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one row per recruiter, in the order the server sent them', () => {
    render(<RecruiterLoad rows={[
      { user_id: 'u1', name: 'Anna', open_tasks: 3, intakes_planned: 1, too_long_in_stage: 0 },
      { user_id: 'u2', name: 'Bram', open_tasks: 5, intakes_planned: 2, too_long_in_stage: 4 },
    ]} />)
    const rows = screen.getAllByText(/Anna|Bram/)
    expect(rows.map(r => r.textContent)).toEqual(['Anna', 'Bram'])
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })
})
