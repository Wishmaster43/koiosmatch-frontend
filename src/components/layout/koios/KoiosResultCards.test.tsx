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
    ['calllist', 'outreach'],
    ['workflow', 'aiagents'],
  ])('maps %s refs to the %s page', async (type, page) => {
    const user = userEvent.setup()
    openEntity.mockClear()
    render(<KoiosResultCards refs={[{ type, id: 'x1', label: 'Row' }]} />)
    await user.click(screen.getByText('Row'))
    expect(openEntity).toHaveBeenCalledWith(page, 'x1')
  })

  // A child ref with no route yet (appointment/note/document — honest skip, see koiosResultLinks) still renders the card — non-interactively.
  it('renders a non-clickable card for a type without a page', async () => {
    const user = userEvent.setup()
    render(<KoiosResultCards refs={[{ type: 'appointment', id: 'a1', label: 'intake · 02-09-2026' }]} />)
    const card = screen.getByText('intake · 02-09-2026').closest('div, button')
    expect(card?.tagName).toBe('DIV')
    await user.click(screen.getByText('intake · 02-09-2026'))
    expect(openEntity).not.toHaveBeenCalled()
  })

  // DATUM-1: a server-composed label carrying an ISO date renders DD-MM-YYYY, never raw ISO.
  it('rewrites an embedded ISO date in the label to DD-MM-YYYY', () => {
    render(<KoiosResultCards refs={[{ type: 'candidate', id: 'c1', label: 'intake · 2026-09-02' }]} />)
    expect(screen.getByText('intake · 02-09-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-09-02/)).not.toBeInTheDocument()
  })

  // The same record surfacing from two steps collapses to one card.
  it('de-dupes refs by type+id', () => {
    render(<KoiosResultCards refs={[
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
    ]} />)
    expect(screen.getAllByText('Ahmed Vos')).toHaveLength(1)
  })

  // A subtitle renders as a caption line under the label.
  it('renders a subtitle under the label', () => {
    render(<KoiosResultCards refs={[{ type: 'candidate', id: 'c1', label: 'Ahmed Vos', subtitle: 'Verpleegkundige' }]} />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })

  // Six measured child-ref routings (koiosResultLinks CHILD_REF_TAB): the card
  // opens the PARENT's page + its measured drawer sub-tab, never a route of its own.
  it.each([
    ['appointment', 'candidate', 'candidates', 'planning'],
    ['note', 'candidate', 'candidates', 'communication'],
    ['document', 'candidate', 'candidates', 'documents'],
    ['appointment', 'vacancy', 'vacancies', 'appointments'],
    ['note', 'vacancy', 'vacancies', 'notes'],
    ['document', 'customer', 'customers', 'documents'],
  ])('routes a %s child ref with a %s parent to %s tab %s', async (childType, parentType, page, tab) => {
    const user = userEvent.setup()
    openEntity.mockClear()
    render(<KoiosResultCards refs={[
      { type: childType, id: 'child1', label: 'Row', parent: { type: parentType, id: 'p1' } },
    ]} />)
    await user.click(screen.getByText('Row'))
    expect(openEntity).toHaveBeenCalledWith(page, 'p1', tab)
  })

  // A child ref whose parent type has no matching drawer tab still opens the parent, without a tab param.
  it('opens the parent without a tab when the parent drawer has no matching tab', async () => {
    const user = userEvent.setup()
    render(<KoiosResultCards refs={[
      { type: 'document', id: 'd1', label: 'Row', parent: { type: 'opportunity', id: 'p1' } },
    ]} />)
    await user.click(screen.getByText('Row'))
    expect(openEntity).toHaveBeenCalledWith('opportunities', 'p1')
  })

  // A child ref missing `parent` entirely stays the existing non-clickable fallback.
  it('renders non-clickable when a child ref has no parent at all', async () => {
    const user = userEvent.setup()
    render(<KoiosResultCards refs={[{ type: 'note', id: 'n1', label: 'Row' }]} />)
    const card = screen.getByText('Row').closest('div, button')
    expect(card?.tagName).toBe('DIV')
    await user.click(screen.getByText('Row'))
    expect(openEntity).not.toHaveBeenCalled()
  })
})
// Reference guard: a child ref whose PARENT type has no page mapping stays a
// calm non-clickable div — never a guessed route (§3 no fake affordance).
it('renders a child ref with an unknown parent type as non-clickable', () => {
  openEntity.mockClear()
  render(<KoiosResultCards refs={[{ type: 'note', id: 'n1', label: 'Notitie', parent: { type: 'mystery' as never, id: 'x1' } }]} />)
  const el = screen.getByText('Notitie').closest('div')
  expect(el?.getAttribute('role')).not.toBe('button')
  expect(openEntity).not.toHaveBeenCalled()
})

