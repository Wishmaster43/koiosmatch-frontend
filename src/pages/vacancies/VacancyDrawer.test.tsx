/**
 * VacancyDrawer — Danny 21-07 regression guard: "Beschrijving" is now its own
 * main tab (right after Details), rendering the extracted DescriptionTab. Every
 * other tab body is stubbed (mirrors ApplicationDrawer.test.tsx) so only the
 * header + tab bar + the tab under test actually mount.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so the tab labels resolve genuine Dutch text.
import '@/i18n'
import VacancyDrawer from './VacancyDrawer'
import type { VacancyDetail } from '@/types/vacancy'

// Lookups/custom-fields arrive via mocked hooks — no provider needed.
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ statuses: [] }),
}))
vi.mock('@/lib/useVacancyCustomFields', () => ({ useVacancyCustomFields: () => ({ fields: [] }) }))
// Every other tab body pulls in its own API/react-query dependencies, irrelevant
// to this tab-bar guard — stub them (mirrors DetailsTab.test.tsx / ApplicationDrawer.test.tsx).
vi.mock('./drawer/DetailsTab', () => ({ default: () => null }))
vi.mock('./drawer/ApplicantsTab', () => ({ default: () => null }))
vi.mock('./drawer/VacancyAgentTab', () => ({ default: () => null }))
vi.mock('./drawer/PublishingTab', () => ({ default: () => null }))
vi.mock('./drawer/DocumentsTab', () => ({ default: () => null }))
vi.mock('./drawer/TimelineTab', () => ({ default: () => null }))
vi.mock('./drawer/NotesTab', () => ({ default: () => null }))
vi.mock('./drawer/StatisticsTab', () => ({ default: () => null }))
vi.mock('./drawer/MatchingTab', () => ({ default: () => null }))
vi.mock('./drawer/VacancyChangelogPopover', () => ({ default: () => null }))
// Own dedicated fetch/map/lookup tests already cover CandidateSearchTab itself —
// stub it here so this tab-bar/autoExpand guard stays isolated (mirrors the rest).
vi.mock('./drawer/CandidateSearchTab', () => ({ default: () => <div>candidate-search-tab-content</div> }))
// The tab under test — a distinguishable marker proves DescriptionTab (not some
// stale DetailsTab sub-tab) renders behind the new main tab.
vi.mock('./drawer/DescriptionTab', () => ({ default: () => <div>description-tab-content</div> }))

const vacancy = { id: 'v1', title: 'Verpleegkundige', clientName: 'Acme', tags: [] } as unknown as VacancyDetail

describe('VacancyDrawer · Beschrijving main tab (Danny 21-07)', () => {
  it('renders a "Beschrijving" tab right after "Details"', () => {
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} />)
    const tabButtons = screen.getAllByRole('button').filter(b => ['Details', 'Beschrijving'].includes(b.textContent ?? ''))
    expect(tabButtons.map(b => b.textContent)).toEqual(['Details', 'Beschrijving'])
  })

  it('shows the DescriptionTab content when the Beschrijving tab is clicked', async () => {
    const user = userEvent.setup()
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Beschrijving' }))
    expect(screen.getByText('description-tab-content')).toBeInTheDocument()
  })
})

describe('VacancyDrawer · "Kandidaten zoeken" autoExpand (Danny 23-07)', () => {
  it('widens the drawer on activating the tab and restores it on leaving', async () => {
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    const { rerender } = render(
      <VacancyDrawer vacancy={vacancy} onClose={vi.fn()} expanded={false} onToggleExpand={onToggleExpand} />,
    )

    // Activating the map+list tab requests the wider drawer width.
    await user.click(screen.getByRole('button', { name: 'Kandidaten zoeken' }))
    expect(screen.getByText('candidate-search-tab-content')).toBeInTheDocument()
    expect(onToggleExpand).toHaveBeenCalledTimes(1)

    // Simulate the parent applying the requested width, then leave the tab —
    // the previous (collapsed) width is restored.
    rerender(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} expanded onToggleExpand={onToggleExpand} />)
    await user.click(screen.getByRole('button', { name: 'Details' }))
    expect(onToggleExpand).toHaveBeenCalledTimes(2)
  })
})
