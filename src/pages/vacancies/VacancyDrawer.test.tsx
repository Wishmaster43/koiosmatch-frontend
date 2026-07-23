/**
 * VacancyDrawer — Danny 21-07 regression guard: "Beschrijving" is now its own
 * main tab (right after Details), rendering the extracted DescriptionTab. Every
 * other tab body is stubbed (mirrors ApplicationDrawer.test.tsx) so only the
 * header + tab bar + the tab under test actually mount.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so the tab labels resolve genuine Dutch text.
import '@/i18n'
import VacancyDrawer from './VacancyDrawer'
import type { VacancyDetail } from '@/types/vacancy'

// Lookups/custom-fields arrive via mocked hooks — no provider needed. Two known
// statuses so the Kandidaten zoeken gate test below can allow one and exclude the other.
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ statuses: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Gesloten' }] }),
}))
vi.mock('@/lib/useVacancyCustomFields', () => ({ useVacancyCustomFields: () => ({ fields: [] }) }))
// Mutable settings state so one test can set an explicit `vacancy_candidate_tab`
// config without affecting the others (mirrors AddCandidateModal.test.tsx).
const settingsState: { settings: Record<string, unknown> } = { settings: {} }
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => settingsState.settings }
})
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

describe('VacancyDrawer · "Kandidaten zoeken" tenant visibility gate (Danny 23-07)', () => {
  afterEach(() => { settingsState.settings = {} })

  it('hides the tab when the vacancy status is excluded by an explicit tenant config', () => {
    settingsState.settings = { vacancy_candidate_tab: { vacancy_statuses: ['open'] } }
    const closedVacancy = { ...vacancy, statusValue: 'closed' } as unknown as VacancyDetail
    render(<VacancyDrawer vacancy={closedVacancy} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Kandidaten zoeken' })).not.toBeInTheDocument()
  })

  it('still shows the tab for a status the explicit config allows', () => {
    settingsState.settings = { vacancy_candidate_tab: { vacancy_statuses: ['open'] } }
    const openVacancy = { ...vacancy, statusValue: 'open' } as unknown as VacancyDetail
    render(<VacancyDrawer vacancy={openVacancy} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Kandidaten zoeken' })).toBeInTheDocument()
  })
})

describe('VacancyDrawer · initialTab deep-link (VACANCY-MATCH-COUNT-1, Danny 23-07)', () => {
  afterEach(() => { settingsState.settings = {} })

  it('opens straight on "Kandidaten zoeken" when initialTab targets it', () => {
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} initialTab="candidateSearch" />)
    // The tab's content shows immediately — no click needed to switch there.
    expect(screen.getByText('candidate-search-tab-content')).toBeInTheDocument()
    const activeBtn = screen.getByRole('button', { name: 'Kandidaten zoeken' })
    expect(activeBtn).toHaveStyle({ fontWeight: 600 })
  })

  it('falls back to the default tab when the requested tab is gated away, never a blank pane', () => {
    // This vacancy's status is excluded from "Kandidaten zoeken" by tenant config —
    // the requested initialTab must not win; the drawer lands on "Details" instead.
    settingsState.settings = { vacancy_candidate_tab: { vacancy_statuses: ['open'] } }
    const closedVacancy = { ...vacancy, statusValue: 'closed' } as unknown as VacancyDetail
    render(<VacancyDrawer vacancy={closedVacancy} onClose={vi.fn()} initialTab="candidateSearch" />)
    expect(screen.queryByRole('button', { name: 'Kandidaten zoeken' })).not.toBeInTheDocument()
    expect(screen.queryByText('candidate-search-tab-content')).not.toBeInTheDocument()
    const detailsBtn = screen.getByRole('button', { name: 'Details' })
    expect(detailsBtn).toHaveStyle({ fontWeight: 600 })
  })
})
