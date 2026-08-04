/**
 * OpportunitiesPage · VESTIGING-2 branch filter — covers the two things a page
 * render can prove that a hook-level test can't: (a) the branch multiselect is
 * fed to useOpportunitiesData as the real server-side `branchIds` argument
 * (mirrors the request-assertion in useOpportunitiesData.test.tsx), and (b) an
 * explicit branch filter that comes back empty renders the honesty notice —
 * never a bare "nothing here" — per CLAUDE.md §13 ("mutation tests assert the
 * request, never only that a callback fired").
 *
 * The heavy data hook (useOpportunitiesData) is mocked wholesale so this test
 * never needs a QueryClientProvider/real API — mirrors OverviewTab.test.tsx's
 * strategy of mocking every fetching hook directly. The right-panel filter UI
 * itself renders in a DIFFERENT part of the tree (DashboardLayout), so the
 * 'branch' filter group's own `onToggle` is captured off the registerFilters
 * call and invoked directly here — exactly what a real click on that filter
 * chip would trigger.
 *
 * usePageMemory (lib/usePageMemory) is a MODULE-LEVEL store shared across every
 * test in this file (by design — it survives page unmounts), so the toggle test
 * below cleans its own pick back off at the end to avoid leaking state into a
 * later test.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import OpportunitiesPage from './OpportunitiesPage'

const cm = (key: string) => i18n.t(key, { ns: 'common' })

interface FilterGroup { key: string; selected: string[]; onToggle: (v: string) => void }

// OpportunityDrawer's useCustomFields fires GET /custom-fields unconditionally
// (before its own `if (!o) return null` guard) — mocked so this test never makes
// a real, unmocked network call (mirrors OverviewTab.test.tsx's approach).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

// Captures the exact args OpportunitiesPage calls the data hook with, per render.
const useOpportunitiesDataMock = vi.fn()
vi.mock('./hooks/useOpportunitiesData', () => ({
  useOpportunitiesData: (...args: unknown[]) => useOpportunitiesDataMock(...args),
  OPPORTUNITIES_MAX_PER_PAGE: 200,
}))
vi.mock('./hooks/useOpportunityArchive', () => ({
  useOpportunityArchive: () => ({ archiveOpportunity: vi.fn(), restoreOpportunity: vi.fn(), dialog: null }),
}))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'b1', label: 'Vestiging Noord' }, { value: 'b2', label: 'Vestiging Zuid' }],
}))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))
// user.branch_ids empty ⇒ unrestricted (every location offered) — the widest,
// least-surprising default for a test that doesn't care about that narrowing.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { branch_ids: [] }, hasPermission: () => true }),
}))
// Capture the registered filter groups so the 'branch' group's onToggle can be
// invoked directly — the real picker renders in DashboardLayout, not this page.
let capturedGroups: FilterGroup[] = []
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({
    registerFilters: (_key: string, groups: FilterGroup[]) => { capturedGroups = groups },
    unregisterFilters: () => {},
    reportPageFilter: () => {},
  }),
}))

// Default (no filter active) hook result — individual tests override via mockReturnValue.
const baseResult = {
  rows: [], loading: false, error: false, customers: [], users: [], stages: [],
  selected: null, drawerExpanded: false, setDrawerExpanded: vi.fn(),
  selectedIds: new Set(), toggleRow: vi.fn(), toggleAll: vi.fn(), clearSelection: vi.fn(),
  selectOpportunity: vi.fn(), closeDrawer: vi.fn(), handleCreated: vi.fn(), handleMove: vi.fn(),
  updateOpportunity: vi.fn(), reload: vi.fn(),
}

describe('OpportunitiesPage · branch filter wiring (VESTIGING-2)', () => {
  it('calls useOpportunitiesData with the picked branch ids as the second (server-side) argument', async () => {
    useOpportunitiesDataMock.mockReturnValue(baseResult)
    render(<OpportunitiesPage />)
    // Default render: no branch picked yet — sent as an empty array, never
    // omitted (mirrors the hook's own default), so a later pick is a real change.
    // Third argument = the NUMMER-1 reference query, null while the search box is empty.
    expect(useOpportunitiesDataMock).toHaveBeenCalledWith(false, [], null)
    // Let OpportunityDrawer's own (unconditional) custom-fields fetch settle so its
    // state update never lands outside act() in a later test (mirrors OverviewTab.test.tsx).
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })

  it('does NOT show the branch-exclusion notice when no branch filter is active, even with zero rows', async () => {
    useOpportunitiesDataMock.mockReturnValue({ ...baseResult, rows: [] })
    render(<OpportunitiesPage />)
    expect(screen.queryByText(cm('filters.branchExcludesUnassigned'))).toBeNull()
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })
})

describe('OpportunitiesPage · view switcher (shared ViewModeToggle, soft-fill audit)', () => {
  it('switches table ⇄ board on click, reflected in aria-pressed and the mounted content', async () => {
    useOpportunitiesDataMock.mockReturnValue(baseResult)
    render(<OpportunitiesPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    // 'rowsPerPage' only renders inside the table view's PaginationBar (ViewSwitch
    // keeps both views mounted, toggling display — never unmounted), so its
    // visibility is a real, content-level proof the active view actually changed.
    const opportunitiesT = (key: string) => i18n.t(key, { ns: 'opportunities' })
    const tableToggle = screen.getByRole('button', { name: opportunitiesT('view.table') })
    const boardToggle = screen.getByRole('button', { name: opportunitiesT('view.board') })

    // Initial state: table is active.
    expect(tableToggle).toHaveAttribute('aria-pressed', 'true')
    expect(boardToggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(cm('rowsPerPage'))).toBeVisible()

    // Click board — the switch fires and the board content becomes the visible one.
    act(() => boardToggle.click())
    expect(boardToggle).toHaveAttribute('aria-pressed', 'true')
    expect(tableToggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(cm('rowsPerPage'))).not.toBeVisible()

    // Click back to table — round-trip proves the toggle is fully wired, not one-way.
    act(() => tableToggle.click())
    expect(tableToggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(cm('rowsPerPage'))).toBeVisible()
  })
})

describe('OpportunitiesPage · picking a branch (VESTIGING-2)', () => {
  it('re-fetches with the picked branch id AND shows the honesty notice once the (branch-filtered) result is empty — never a bare empty state', async () => {
    useOpportunitiesDataMock.mockReturnValue({ ...baseResult, rows: [] })
    render(<OpportunitiesPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const branchGroup = capturedGroups.find(g => g.key === 'branch')
    expect(branchGroup).toBeTruthy()
    // Exactly what clicking the "Vestiging Noord" chip in the real filter panel does.
    act(() => branchGroup!.onToggle('b1'))

    // The page re-rendered with the pick — the data hook is called again with it.
    expect(useOpportunitiesDataMock).toHaveBeenLastCalledWith(false, ['b1'], null)
    // Zero rows + an explicit branch filter ⇒ the honesty notice, not silence.
    expect(screen.getByText(cm('filters.branchExcludesUnassigned'))).toBeInTheDocument()

    // Clean up: usePageMemory is a module-level store shared across this file's
    // tests — toggle the pick back off so it doesn't leak into a later test.
    act(() => branchGroup!.onToggle('b1'))
  })

  it('does not show the notice once the branch-filtered result actually has rows', async () => {
    useOpportunitiesDataMock.mockReturnValue({ ...baseResult, rows: [{ id: 'o1', title: 'Deal A' }] })
    render(<OpportunitiesPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const branchGroup = capturedGroups.find(g => g.key === 'branch')!
    act(() => branchGroup.onToggle('b1'))
    expect(screen.queryByText(cm('filters.branchExcludesUnassigned'))).toBeNull()

    act(() => branchGroup.onToggle('b1')) // clean up, see note above
  })
})

/**
 * NUMMER-1 — typing KA-00042 must become an exact server-side `?ref=` lookup (third
 * argument to the data hook), and the deal the server returns must SURVIVE the page's
 * client-side pass: that filter reads only title/client, so without the ref branch it
 * would drop the one hit the server just found. Free text keeps the old behaviour.
 *
 * The visible-row count is read off the PaginationBar ("Geen resultaten" vs a range),
 * because the page renders its DataTable virtualized against a scroll container that
 * has no height in jsdom — the pagination text is driven by the SAME `filteredAll`
 * array, so it proves the filter outcome without depending on row rendering. The
 * column itself is covered in OpportunitiesTable.test.tsx.
 *
 * The search box debounces 300ms, hence the generous waitFor timeouts. usePageMemory
 * is module-level, so each test clears the box again in a finally — a failed
 * assertion must not leak its search text into the next test.
 */
describe('OpportunitiesPage · reference-number search (NUMMER-1)', () => {
  const searchLabel = () => i18n.t('page.searchPlaceholder', { ns: 'opportunities' })
  // The one deal a ?ref= lookup returns — its number appears in no free-text field.
  const refHit = { id: 'o1', title: 'Detachering ICU', client: 'Zorgpartners', referenceNumber: 'KA-00042' }

  it('sends the typed reference number to the data hook and keeps the matched deal in the result set', async () => {
    const user = userEvent.setup()
    useOpportunitiesDataMock.mockReturnValue({ ...baseResult, rows: [refHit] })
    render(<OpportunitiesPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    try {
      await user.type(screen.getByLabelText(searchLabel()), 'KA-00042')
      await waitFor(
        () => expect(useOpportunitiesDataMock).toHaveBeenLastCalledWith(false, [], 'KA-00042'),
        { timeout: 2000 },
      )
      // The server-matched deal survives the client-side filter pass (1 row, not 0).
      expect(screen.queryByText(cm('noResults'))).toBeNull()
    } finally {
      await user.clear(screen.getByLabelText(searchLabel()))
      await waitFor(() => expect(useOpportunitiesDataMock).toHaveBeenLastCalledWith(false, [], null), { timeout: 2000 })
    }
  })

  it('leaves ordinary free text as a client-side filter — no ref is sent', async () => {
    const user = userEvent.setup()
    useOpportunitiesDataMock.mockReturnValue({ ...baseResult, rows: [refHit] })
    render(<OpportunitiesPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    try {
      await user.type(screen.getByLabelText(searchLabel()), 'nietbestaand')
      // Free text still filters locally — the deal drops out, and nothing goes to ?ref=.
      await waitFor(() => expect(screen.getByText(cm('noResults'))).toBeInTheDocument(), { timeout: 2000 })
      expect(useOpportunitiesDataMock).toHaveBeenLastCalledWith(false, [], null)
    } finally {
      await user.clear(screen.getByLabelText(searchLabel()))
      await waitFor(() => expect(screen.queryByText(cm('noResults'))).toBeNull(), { timeout: 2000 })
    }
  })
})
