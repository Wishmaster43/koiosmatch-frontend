/**
 * CustomersPage · VESTIGING-2 branch filter — covers the two things a page
 * render can prove that a hook-level test can't: (a) the branch multiselect
 * reaches the server-side `filterParams` as a real `branch_id[]` value (the
 * customers/vacancies pages build filterParams inline, with no separate
 * testable hook — unlike applications' useApplicationFilters, which already
 * has its own request-level test), and (b) an explicit branch filter that
 * comes back empty renders the honesty notice — never a bare "nothing here" —
 * per CLAUDE.md §13 ("mutation tests assert the request, never only that a
 * callback fired"). Mirrors OpportunitiesPage.test.tsx's recipe.
 *
 * The heavy data hook (useCustomersData) is mocked wholesale so this test
 * never needs a QueryClientProvider/real API. The right-panel filter UI itself
 * renders in a DIFFERENT part of the tree (DashboardLayout), so the 'branch'
 * filter group's own `onToggle` is captured off the registerFilters call and
 * invoked directly here — exactly what a real click on that filter chip would
 * trigger.
 *
 * usePageMemory (lib/usePageMemory) is a MODULE-LEVEL store shared across every
 * test in this file (by design — it survives page unmounts), so the toggle
 * test below cleans its own pick back off at the end to avoid leaking state
 * into a later test.
 */
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CustomersPage from './CustomersPage'

const cm = (key: string) => i18n.t(key, { ns: 'common' })
const cu = (key: string) => i18n.t(key, { ns: 'customers' })

interface FilterGroup { key: string; selected: string[]; onToggle: (v: string) => void }

// Various child components (drawer, tables) fire their own unconditional
// fetches (custom-fields, etc.) — mocked so this test never makes a real,
// unmocked network call (mirrors OverviewTab.test.tsx's approach).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

// Captures the exact args CustomersPage calls the data hook with, per render.
const useCustomersDataMock = vi.fn()
vi.mock('./hooks/useCustomersData', () => ({
  useCustomersData: (...args: unknown[]) => useCustomersDataMock(...args),
  CUSTOMERS_MAX_PER_PAGE: 200,
}))
vi.mock('./hooks/useCustomerRecord', () => ({
  useCustomerRecord: () => ({
    selected: null, detail: null, drawerExpanded: false, setDrawerExpanded: vi.fn(), drawerTab: undefined,
    closeDrawer: vi.fn(), selectCustomer: vi.fn(), updateCustomer: vi.fn(), handleCreate: vi.fn(), addNote: vi.fn(),
  }),
}))
vi.mock('./hooks/useCustomerBulkActions', () => ({
  useCustomerBulkActions: () => ({
    toggleRow: vi.fn(), toggleAll: vi.fn(), bulkSetOwner: vi.fn(), bulkSetStatus: vi.fn(),
    bulkAddTag: vi.fn(), bulkRemoveTag: vi.fn(), bulkAddNote: vi.fn(), bulkArchive: vi.fn(),
    bulkGeocode: vi.fn(), selectedTags: [], dialog: null,
  }),
}))
vi.mock('@/lib/useCustomerLookups', () => ({
  useCustomerLookups: () => ({
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex mirroring the real hook's own neutral-fallback colour, not a UI choice
    statuses: [], statusMeta: () => ({ value: '', label: '—', color: '#9CA3AF' }),
    locationStatuses: [], departmentStatuses: [], contactStatuses: [],
  }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'b1', label: 'Vestiging Noord' }, { value: 'b2', label: 'Vestiging Zuid' }],
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
  customers: [], setCustomers: vi.fn(), loading: false, error: null,
  total: 0, setTotal: vi.fn(), lastPage: 1, stats: null,
}

describe('CustomersPage · branch filter wiring (VESTIGING-2)', () => {
  it('builds filterParams with no branch_id by default', async () => {
    useCustomersDataMock.mockReturnValue(baseResult)
    render(<CustomersPage />)
    const [{ filterParams }] = useCustomersDataMock.mock.calls[0]
    expect(filterParams.branch_id).toBeUndefined()
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })

  it('does NOT show the branch-exclusion notice when no branch filter is active, even with zero rows', async () => {
    useCustomersDataMock.mockReturnValue(baseResult)
    render(<CustomersPage />)
    expect(screen.queryByText(cm('filters.branchExcludesUnassigned'))).toBeNull()
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
  })
})

describe('CustomersPage · picking a branch (VESTIGING-2)', () => {
  it('re-builds filterParams with the picked branch id AND shows the honesty notice once the (branch-filtered) total is zero — never a bare empty state', async () => {
    useCustomersDataMock.mockReturnValue(baseResult)
    render(<CustomersPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const branchGroup = capturedGroups.find(g => g.key === 'branch')
    expect(branchGroup).toBeTruthy()
    // Exactly what clicking the "Vestiging Noord" chip in the real filter panel does.
    act(() => branchGroup!.onToggle('b1'))

    const lastCall = useCustomersDataMock.mock.calls.at(-1)![0]
    expect(lastCall.filterParams.branch_id).toEqual(['b1'])
    // Zero total + an explicit branch filter ⇒ the honesty notice, not silence.
    expect(screen.getByText(cm('filters.branchExcludesUnassigned'))).toBeInTheDocument()

    // Clean up: usePageMemory is a module-level store shared across this file's
    // tests — toggle the pick back off so it doesn't leak into a later test.
    act(() => branchGroup!.onToggle('b1'))
  })

  it('does not show the notice once the branch-filtered total is actually non-zero', async () => {
    useCustomersDataMock.mockReturnValue({ ...baseResult, total: 3 })
    render(<CustomersPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const branchGroup = capturedGroups.find(g => g.key === 'branch')!
    act(() => branchGroup.onToggle('b1'))
    expect(screen.queryByText(cm('filters.branchExcludesUnassigned'))).toBeNull()

    act(() => branchGroup.onToggle('b1')) // clean up, see note above
  })
})

// FILTER-PARITY-1: province/phase/archived groups exist and their onToggle reaches
// the real server-side filterParams — the seam test the CLAUDE.md §13 rule asks for.
describe('CustomersPage · filter-panel parity (province/phase/archived)', () => {
  it('registers province and phase filter groups, and toggling them sets state/phase in filterParams', async () => {
    useCustomersDataMock.mockReturnValue(baseResult)
    render(<CustomersPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const provinceGroup = capturedGroups.find(g => g.key === 'province')
    const phaseGroup = capturedGroups.find(g => g.key === 'phase')
    expect(provinceGroup).toBeTruthy()
    expect(phaseGroup).toBeTruthy()

    act(() => provinceGroup!.onToggle('Utrecht'))
    let lastCall = useCustomersDataMock.mock.calls.at(-1)![0]
    expect(lastCall.filterParams.state).toEqual(['Utrecht'])
    act(() => provinceGroup!.onToggle('Utrecht')) // clean up

    act(() => phaseGroup!.onToggle('klant'))
    lastCall = useCustomersDataMock.mock.calls.at(-1)![0]
    expect(lastCall.filterParams.phase).toEqual(['klant'])
    act(() => phaseGroup!.onToggle('klant')) // clean up
  })

  it('registers an archived filter group whose onToggle sets include_archived=1', async () => {
    useCustomersDataMock.mockReturnValue(baseResult)
    render(<CustomersPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const archivedGroup = capturedGroups.find(g => g.key === 'archived')
    expect(archivedGroup).toBeTruthy()

    act(() => archivedGroup!.onToggle('archived'))
    const lastCall = useCustomersDataMock.mock.calls.at(-1)![0]
    expect(lastCall.filterParams.include_archived).toBe(1)
    act(() => archivedGroup!.onToggle('archived')) // clean up
  })
})

// TOOLBAR-PARITY-1 (Danny 14-08): the candidates toolbar carries QuickViewToggles
// for Archived + Map (Trash/Blacklist are candidate-only, see skipped notes) — this
// asserts clicking the REAL toolbar buttons (not the filter-panel proxy above)
// reaches the request param / view state, mirroring CandidatesToolbar.test.tsx's seam.
describe('CustomersPage · toolbar quick-view toggles (candidate parity, TOOLBAR-PARITY-1)', () => {
  it('clicking the toolbar Archived toggle sets include_archived=1 in filterParams and shows aria-pressed=true', async () => {
    useCustomersDataMock.mockReturnValue(baseResult)
    const user = userEvent.setup()
    render(<CustomersPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const archivedBtn = screen.getByRole('button', { name: cu('page.archivedView') })
    expect(archivedBtn).toHaveAttribute('aria-pressed', 'false')
    await user.click(archivedBtn)

    expect(archivedBtn).toHaveAttribute('aria-pressed', 'true')
    const lastCall = useCustomersDataMock.mock.calls.at(-1)![0]
    expect(lastCall.filterParams.include_archived).toBe(1)

    await user.click(archivedBtn) // clean up (module-level usePageMemory store)
  })

  it('clicking the toolbar Map toggle flips aria-pressed and switches the view to map', async () => {
    useCustomersDataMock.mockReturnValue(baseResult)
    const user = userEvent.setup()
    render(<CustomersPage />)
    await waitFor(() => expect(apiGet).toHaveBeenCalled())

    const mapBtn = screen.getByRole('button', { name: cm('map.view') })
    expect(mapBtn).toHaveAttribute('aria-pressed', 'false')
    await user.click(mapBtn)
    expect(mapBtn).toHaveAttribute('aria-pressed', 'true')
    // Table pagination (table-view only content) is no longer the active pane —
    // the map's loading fallback (Suspense) proves the map view rendered.
    await waitFor(() => expect(screen.getByText(cm('map.loading'))).toBeInTheDocument())

    await user.click(mapBtn) // clean up
  })
})
