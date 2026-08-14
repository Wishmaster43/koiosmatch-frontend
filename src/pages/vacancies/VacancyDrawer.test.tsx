/**
 * VacancyDrawer — Danny 21-07 regression guard: the vacancy text is its own
 * main tab (right after Details), rendering the extracted DescriptionTab.
 * VAC-TEKST-TAB-1 (Danny 14-08 punt 10): its label is "Vacaturetekst" (was
 * "Beschrijving") — reuses the existing details.description key. Every
 * other tab body is stubbed (mirrors ApplicationDrawer.test.tsx) so only the
 * header + tab bar + the tab under test actually mount.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) init so the tab labels resolve genuine Dutch text.
import i18n from '@/i18n'
import api from '@/lib/api'
import VacancyDrawer from './VacancyDrawer'
import type { VacancyDetail } from '@/types/vacancy'

// TRASH-OVERAL-2: api + the grace-window read serve the shared TrashLifecycleSection
// (deletion-preview GET, mark/unmark POSTs) rendered via the `trash` prop.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: { data: { lifecycle: 'pending_erase' } } })),
  },
  // useAllSettings' importActual below reaches this too (tenant-keyed caches).
  getActiveTenantId: () => null,
  unwrap: (res: { data?: unknown }) => {
    const body = res?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
}))
vi.mock('@/pages/settings/lib/settingsApi', () => ({
  loadSettings: () => Promise.resolve({ deletion_grace_days: '30' }),
}))

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
vi.mock('./drawer/MatchesTab', () => ({ default: () => null }))
// Danny 27-07: VacancyDrawer now wires the shared house ChangelogPopover shell
// directly (@/components/drawer/ChangelogPopover) with this file's own ChangelogTab
// as content — stub the content component; it only ever mounts once the popover is
// opened (untested here), so this stub just keeps the import graph light.
vi.mock('./drawer/ChangelogTab', () => ({ default: () => null }))
// Own dedicated fetch/map/lookup tests already cover CandidateSearchTab itself —
// stub it here so this tab-bar/autoExpand guard stays isolated (mirrors the rest).
vi.mock('./drawer/CandidateSearchTab', () => ({ default: () => <div>candidate-search-tab-content</div> }))
// The tab under test — a distinguishable marker proves DescriptionTab (not some
// stale DetailsTab sub-tab) renders behind the new main tab.
vi.mock('./drawer/DescriptionTab', () => ({ default: () => <div>description-tab-content</div> }))

const vacancy = { id: 'v1', title: 'Verpleegkundige', clientName: 'Acme', tags: [] } as unknown as VacancyDetail

describe('VacancyDrawer · Vacaturetekst main tab (Danny 21-07, renamed 14-08)', () => {
  it('renders a "Vacaturetekst" tab right after "Details"', () => {
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} />)
    const tabButtons = screen.getAllByRole('tab').filter(b => ['Details', 'Vacaturetekst'].includes(b.textContent ?? ''))
    expect(tabButtons.map(b => b.textContent)).toEqual(['Details', 'Vacaturetekst'])
  })

  it('shows the DescriptionTab content when the Vacaturetekst tab is clicked', async () => {
    const user = userEvent.setup()
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Vacaturetekst' }))
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
    await user.click(screen.getByRole('tab', { name: 'Kandidaten zoeken' }))
    expect(screen.getByText('candidate-search-tab-content')).toBeInTheDocument()
    expect(onToggleExpand).toHaveBeenCalledTimes(1)

    // Simulate the parent applying the requested width, then leave the tab —
    // the previous (collapsed) width is restored.
    rerender(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} expanded onToggleExpand={onToggleExpand} />)
    await user.click(screen.getByRole('tab', { name: 'Details' }))
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
    expect(screen.getByRole('tab', { name: 'Kandidaten zoeken' })).toBeInTheDocument()
  })
})

describe('VacancyDrawer · initialTab deep-link (VACANCY-MATCH-COUNT-1, Danny 23-07)', () => {
  afterEach(() => { settingsState.settings = {} })

  it('opens straight on "Kandidaten zoeken" when initialTab targets it', () => {
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} initialTab="candidateSearch" />)
    // The tab's content shows immediately — no click needed to switch there.
    expect(screen.getByText('candidate-search-tab-content')).toBeInTheDocument()
    const activeBtn = screen.getByRole('tab', { name: 'Kandidaten zoeken' })
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
    const detailsBtn = screen.getByRole('tab', { name: 'Details' })
    expect(detailsBtn).toHaveStyle({ fontWeight: 600 })
  })
})

// TRASH-OVERAL-2: the drawer's trash surface — REQUEST-asserting (§13): the exact
// mark POST with and without transfer_to_owner_id, the unmark POST, and the
// permission-hidden mark action (vacancies.delete / vacancies.update via the page).
describe('VacancyDrawer · trash lifecycle (TRASH-OVERAL-2)', () => {
  const tc = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })
  const PREVIEW = { blocking: [], transferable: null, can_mark: true, lifecycle: 'archived' }
  const trashWiring = (over: Partial<Record<string, unknown>> = {}) => ({
    canMark: true, canUnmark: true,
    users: [{ value: 'u-1', label: 'Anna de Vries' }],
    onMarked: vi.fn(), onUnmarked: vi.fn(), ...over,
  })

  it('mark flow: preview GET + confirm POSTs /vacancies/{id}/mark-deletion with an EMPTY body', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: PREVIEW } })
    const wiring = trashWiring()
    const user = userEvent.setup()
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} trash={wiring} />)

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/vacancies/v1/deletion-preview'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancies/v1/mark-deletion', {}, { quietStatuses: [409] }))
    expect(wiring.onMarked).toHaveBeenCalledWith('v1')
  })

  it('mark flow with a picked transfer owner sends {transfer_to_owner_id}', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...PREVIEW, transferable: { attribute: 'owner_id', current_owner_id: null } } } })
    const user = userEvent.setup()
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} trash={trashWiring()} />)

    await user.click(screen.getByRole('button', { name: tc('trash.markAction') as string }))
    await user.click(await screen.findByText(tc('trash.modal.transferPlaceholder') as string))
    await user.click(screen.getByText('Anna de Vries'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: tc('trash.modal.confirm') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancies/v1/mark-deletion',
      { transfer_to_owner_id: 'u-1' }, { quietStatuses: [409] }))
  })

  it('hides the mark action without vacancies.delete (no fake affordances)', () => {
    render(<VacancyDrawer vacancy={vacancy} onClose={vi.fn()} trash={trashWiring({ canMark: false })} />)
    expect(screen.queryByRole('button', { name: tc('trash.markAction') as string })).toBeNull()
  })

  it('unmark on a pending_erase record POSTs /vacancies/{id}/unmark-deletion', async () => {
    const wiring = trashWiring()
    const pending = { ...vacancy, archived: true, lifecycle: 'pending_erase', pendingEraseAt: '2026-08-01T10:00:00Z' } as VacancyDetail
    const user = userEvent.setup()
    render(<VacancyDrawer vacancy={pending} onClose={vi.fn()} trash={wiring} />)

    await user.click(screen.getByRole('button', { name: tc('trash.unmarkAction') as string }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vacancies/v1/unmark-deletion'))
    expect(wiring.onUnmarked).toHaveBeenCalledWith('v1')
  })
})
