import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosResultCards from './KoiosResultCards'

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

describe('KoiosResultCards', () => {
  beforeEach(() => { openEntity.mockClear() })

  // Dormant: no refs at all → renders nothing (no dead UI before the BE ships them).
  it('renders nothing for an empty refs list', () => {
    const { container } = render(<KoiosResultCards refs={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  // A mapped type (candidate) navigates to its page via the shared intent on click.
  it('navigates to the mapped page when a clickable card is clicked', async () => {
    const user = userEvent.setup()
    render(<KoiosResultCards refs={[{ type: 'candidate', id: 'c1', label: 'Ahmed Vos' }]} />)
    await user.click(screen.getByText('Ahmed Vos'))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c1')
  })

  // Every required type (KOIOS-AGENT-PLAN §7 Job 3) maps to its real page.
  it.each([
    ['candidate', 'candidates'],
    ['vacancy', 'vacancies'],
    ['customer', 'customers'],
    ['application', 'applications'],
    ['match', 'matches'],
    ['opportunity', 'opportunities'],
    ['task', 'tasks'],
    ['outreach_campaign', 'outreach'],
  ])('maps %s refs to the %s page', async (type, page) => {
    const user = userEvent.setup()
    openEntity.mockClear()
    render(<KoiosResultCards refs={[{ type, id: 'x1', label: 'Row' }]} />)
    await user.click(screen.getByText('Row'))
    expect(openEntity).toHaveBeenCalledWith(page, 'x1')
  })

  // A type with no page yet (e.g. a workflow) still renders the card — non-interactively.
  it('renders a non-clickable card for a type without a page', async () => {
    const user = userEvent.setup()
    render(<KoiosResultCards refs={[{ type: 'workflow', id: 'w1', label: 'Onboarding flow' }]} />)
    const card = screen.getByText('Onboarding flow').closest('div, button')
    expect(card?.tagName).toBe('DIV')
    await user.click(screen.getByText('Onboarding flow'))
    expect(openEntity).not.toHaveBeenCalled()
  })

  // The same record surfacing from two steps collapses to one card.
  it('de-dupes refs by type+id', () => {
    render(<KoiosResultCards refs={[
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
    ]} />)
    expect(screen.getAllByText('Ahmed Vos')).toHaveLength(1)
  })
})
