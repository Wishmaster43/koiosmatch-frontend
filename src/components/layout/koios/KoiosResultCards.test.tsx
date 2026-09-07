import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosResultCards from './KoiosResultCards'
import i18n from '@/i18n'
import type { KoiosSearchResultsGrouped, KoiosResultRef } from './koiosTypes'

const openEntity = vi.fn()
// The cards translate their group labels in the koios namespace themselves (real i18n,
// lazily loaded in the app by the Koios panel): load it once here.
beforeAll(async () => { await i18n.loadNamespaces('koios') })

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

const t = (key: string, opts?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    'koios.results.group.kandidaten': 'Candidates',
    'koios.results.group.vacatures': 'Vacancies',
    'koios.results.group.klanten': 'Customers',
    'koios.results.group.kansen': 'Opportunities',
    'koios.results.group.matches': 'Matches',
    'koios.results.showMore': 'Toon meer',
    'koios.results.showLess': 'Toon minder',
    'koios.results.skipped': `Skipped: ${opts?.reason || ''}`,
  }
  return map[key] || key
}

describe('KoiosResultCards — grouped results', () => {
  beforeEach(() => { openEntity.mockClear() })

  // Renders nothing when groups and skipped are both empty.
  it('renders nothing for empty groups and skipped', () => {
    const { container } = render(<KoiosResultCards groups={{ groups: [], skipped: [] }} t={t} />)
    expect(container).toBeEmptyDOMElement()
  })

  // Renders one group with all refs when the group has ≤5 items.
  it('renders a single group with its label and count', () => {
    const refs: KoiosResultRef[] = [
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
      { type: 'candidate', id: 'c2', label: 'Maria García' },
    ]
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 2, meer: false }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)
    expect(screen.getByText('Kandidaten (2)')).toBeInTheDocument()
    expect(screen.getByText('Ahmed Vos')).toBeInTheDocument()
    expect(screen.getByText('Maria García')).toBeInTheDocument()
  })

  // Shows "Show more" button when group has >5 items.
  it('shows "Show more" button when group has >5 items', () => {
    const refs: KoiosResultRef[] = Array.from({ length: 7 }, (_, i) => ({
      type: 'candidate',
      id: `c${i}`,
      label: `Candidate ${i + 1}`,
    }))
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 7, meer: true }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)
    expect(screen.getByText('Kandidaten (7)')).toBeInTheDocument()
    // Should show only 5 cards by default
    expect(screen.getByText('Candidate 1')).toBeInTheDocument()
    expect(screen.getByText('Candidate 5')).toBeInTheDocument()
    expect(screen.queryByText('Candidate 6')).not.toBeInTheDocument()
    expect(screen.getByText('Toon meer')).toBeInTheDocument()
  })

  // "Show more" button expands to show all items.
  it('expands to show all items when "Show more" is clicked', async () => {
    const user = userEvent.setup()
    const refs: KoiosResultRef[] = Array.from({ length: 7 }, (_, i) => ({
      type: 'candidate',
      id: `c${i}`,
      label: `Candidate ${i + 1}`,
    }))
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 7, meer: true }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)

    await user.click(screen.getByText('Toon meer'))

    // All 7 should now be visible
    expect(screen.getByText('Candidate 6')).toBeInTheDocument()
    expect(screen.getByText('Candidate 7')).toBeInTheDocument()
    // Button should now say "Show less"
    expect(screen.getByText('Toon minder')).toBeInTheDocument()
    expect(screen.queryByText('Toon meer')).not.toBeInTheDocument()
  })

  // Multiple groups render in the order provided (KoiosMessage handles reordering).
  it('renders multiple groups in the order provided', () => {
    const candidateRefs: KoiosResultRef[] = [
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
    ]
    const vacancyRefs: KoiosResultRef[] = [
      { type: 'vacancy', id: 'v1', label: 'Verpleegkundige' },
    ]
    const groups: KoiosSearchResultsGrouped = {
      groups: [
        { entity: 'candidate', refs: candidateRefs, aantal: 1, meer: false },
        { entity: 'vacancy', refs: vacancyRefs, aantal: 1, meer: false },
      ],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)

    const headings = screen.getAllByText(/^(Kandidaten|Vacatures)/)
    expect(headings[0]).toHaveTextContent('Kandidaten (1)')
    expect(headings[1]).toHaveTextContent('Vacatures (1)')
  })

  // De-duplication within a group.
  it('de-dupes refs by type+id within a group', () => {
    const refs: KoiosResultRef[] = [
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
    ]
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 2, meer: false }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)
    expect(screen.getAllByText('Ahmed Vos')).toHaveLength(1)
  })

  // Skipped entities render a notice.
  it('renders a notice for each skipped entity', () => {
    const groups: KoiosSearchResultsGrouped = {
      groups: [],
      skipped: [{ entity: 'vacancy', reden: 'Geen rechten voor vacatures.' }],
    }
    render(<KoiosResultCards groups={groups} t={t} />)
    expect(screen.getByText(/Overgeslagen: Geen rechten voor vacatures/)).toBeInTheDocument()
  })

  // Cards are clickable and navigate correctly.
  it('navigates to the mapped page when a card is clicked', async () => {
    const user = userEvent.setup()
    const refs: KoiosResultRef[] = [
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos' },
    ]
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 1, meer: false }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)

    await user.click(screen.getByText('Ahmed Vos'))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c1')
  })

  // Child refs with parent navigate via parent's drawer tab.
  it('routes a child ref with a parent to the parent page + tab', async () => {
    const user = userEvent.setup()
    const refs: KoiosResultRef[] = [
      { type: 'appointment', id: 'a1', label: 'intake · 02-09-2026', parent: { type: 'candidate', id: 'c1' } },
    ]
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 1, meer: false }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)

    await user.click(screen.getByText(/intake/))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c1', 'planning')
  })

  // Multiple groups with truncation and multiple skipped entities.
  it('renders multiple groups with truncation and skipped entities together', () => {
    const candidateRefs = Array.from({ length: 7 }, (_, i) => ({
      type: 'candidate' as const,
      id: `c${i}`,
      label: `Candidate ${i + 1}`,
    }))
    const vacancyRefs = Array.from({ length: 2 }, (_, i) => ({
      type: 'vacancy' as const,
      id: `v${i}`,
      label: `Vacancy ${i + 1}`,
    }))

    const groups: KoiosSearchResultsGrouped = {
      groups: [
        { entity: 'candidate', refs: candidateRefs, aantal: 7, meer: true },
        { entity: 'vacancy', refs: vacancyRefs, aantal: 2, meer: false },
      ],
      skipped: [
        { entity: 'customer', reden: 'Geen rechten.' },
      ],
    }
    render(<KoiosResultCards groups={groups} t={t} />)

    // Check groups render
    expect(screen.getByText('Kandidaten (7)')).toBeInTheDocument()
    expect(screen.getByText('Vacatures (2)')).toBeInTheDocument()

    // Check truncation
    expect(screen.getByText('Candidate 1')).toBeInTheDocument()
    expect(screen.queryByText('Candidate 6')).not.toBeInTheDocument()
    expect(screen.getByText('Toon meer')).toBeInTheDocument()

    // Check vacancies are fully shown
    expect(screen.getByText('Vacancy 1')).toBeInTheDocument()
    expect(screen.getByText('Vacancy 2')).toBeInTheDocument()

    // Check skipped notice
    expect(screen.getByText(/Overgeslagen: Geen rechten/)).toBeInTheDocument()
  })

  // ISO date rewriting in labels (DATUM-1).
  it('rewrites embedded ISO dates in labels to DD-MM-YYYY', () => {
    const refs: KoiosResultRef[] = [
      { type: 'candidate', id: 'c1', label: 'intake · 2026-09-02' },
    ]
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 1, meer: false }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)
    expect(screen.getByText('intake · 02-09-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-09-02/)).not.toBeInTheDocument()
  })

  // Subtitle renders as caption.
  it('renders subtitle as caption under label', () => {
    const refs: KoiosResultRef[] = [
      { type: 'candidate', id: 'c1', label: 'Ahmed Vos', subtitle: 'Verpleegkundige' },
    ]
    const groups: KoiosSearchResultsGrouped = {
      groups: [{ entity: 'candidate', refs, aantal: 1, meer: false }],
      skipped: [],
    }
    render(<KoiosResultCards groups={groups} t={t} />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
  })
})
