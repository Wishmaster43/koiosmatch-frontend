/**
 * RecruiterLoad — K-173 fase 6: self-hides on an empty feed (mirrors the shared
 * WidgetListBlock convention), otherwise one row per recruiter in server order.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    // New face (Danny: "mooier"): open-task count in Mono next to the name,
    // intakes as a caption, too-long as a warning chip ONLY when non-zero.
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getAllByText('recruiterLoad.intakesCount')).toHaveLength(2)
    expect(screen.getAllByText('recruiterLoad.tooLongCount')).toHaveLength(1)
  })

  it('the load bar scales against the busiest recruiter', () => {
    const { container } = render(<RecruiterLoad rows={[
      { user_id: 'u1', name: 'Anna', open_tasks: 2, intakes_planned: 0, too_long_in_stage: 0 },
      { user_id: 'u2', name: 'Bram', open_tasks: 4, intakes_planned: 0, too_long_in_stage: 0 },
    ]} />)
    const bars = [...container.querySelectorAll('div')].filter(d => d.style.width.endsWith('%'))
    expect(bars.map(b => b.style.width)).toEqual(['50%', '100%'])
  })

  it('clicking a row navigates to that recruiter\'s candidates when onNavigate is given', () => {
    const onNavigate = vi.fn()
    render(<RecruiterLoad onNavigate={onNavigate} rows={[
      { user_id: 'u1', name: 'Anna', open_tasks: 3, intakes_planned: 1, too_long_in_stage: 0 },
      { user_id: 'u2', name: 'Bram', open_tasks: 5, intakes_planned: 2, too_long_in_stage: 4 },
    ]} />)
    const rows = screen.getAllByRole('button')
    fireEvent.click(rows[1])
    expect(onNavigate).toHaveBeenCalledWith('candidates', { owner: 'u2' })
  })

  it('the row is keyboard-operable (role=button, Enter activates) when onNavigate is given', () => {
    const onNavigate = vi.fn()
    render(<RecruiterLoad onNavigate={onNavigate} rows={[
      { user_id: 'u1', name: 'Anna', open_tasks: 3, intakes_planned: 1, too_long_in_stage: 0 },
      { user_id: 'u2', name: 'Bram', open_tasks: 5, intakes_planned: 2, too_long_in_stage: 4 },
    ]} />)
    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(2)
    fireEvent.keyDown(rows[1], { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledWith('candidates', { owner: 'u2' })
  })

  it('rows are inert (no role=button) when onNavigate is not given', () => {
    render(<RecruiterLoad rows={[
      { user_id: 'u1', name: 'Anna', open_tasks: 3, intakes_planned: 1, too_long_in_stage: 0 },
    ]} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
