/**
 * CandidatesPage · REFRESH-FIX-2-PAGETEST-1 — pins the seam useCandidateMutations.test.ts
 * cannot: CandidatesPage.updateCandidate (the real, unmocked function under test) must
 * actually adopt the server-mapped values for the patched keys once the PATCH resolves,
 * in BOTH the open drawer's `selected` state and the matching list row — and it must do
 * so WITHOUT clobbering an optimistically-applied key the server response doesn't carry
 * (the `k in server` guard). Only useCandidateDrawerActions and useCandidateMutations
 * stay real; every other hook is the same thin stub CandidatesPage.selectRace.test.tsx
 * already uses for this page.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useState } from 'react'
import CandidatesPage from './CandidatesPage'
import type { Candidate } from '@/types/candidate'

// Keep the real `unwrap` (useCandidateMutations.ts needs it); only the default
// client's methods are stubbed so the PATCH/GET calls are inspectable.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }
})
import api from '@/lib/api'
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

// mapCandidate is a big real mapper (first/last-name joins, coords, …) that this
// test has no interest in re-verifying — stub it to identity so the mocked PATCH
// body IS the "mapped server candidate" useCandidateMutations.ts hands back.
vi.mock('./data/mapCandidate', () => ({ mapCandidate: (c: unknown) => c }))

// The seeded row this test opens and patches. `firstname` is set here and
// re-sent in the patch below, but the mocked server response (further down)
// never carries it back — pinning the REFRESH-FIX-2 guard (only adopt keys
// present on the mapped server candidate) alongside the main assertion.
const seedCandidate = {
  id: 'c1', name: 'Client Name', firstname: 'Client', stage: '', status: 'available',
  pools: [], tags: [], candidateTypes: [], owner: '', archived: false,
} as unknown as Candidate

// Captures the exact props CandidatesPage hands to the drawer/table — same idiom
// as CandidatesPage.selectRace.test.tsx's CandidatesTable capture.
let lastDrawerProps: Record<string, unknown> = {}
vi.mock('./CandidateDrawer', () => ({
  default: (props: Record<string, unknown>) => {
    lastDrawerProps = props
    const candidate = props.candidate as Candidate | null
    return <span data-testid="drawer-name">{candidate?.name ?? ''}</span>
  },
}))

let lastTableProps: Record<string, unknown> = {}
vi.mock('./CandidatesTable', () => ({
  default: (props: Record<string, unknown>) => {
    lastTableProps = props
    const rows = props.rows as Candidate[]
    const row = rows.find(r => r.id === 'c1')
    return (
      <div>
        <button aria-label="open-c1" onClick={() => (props.onSelect as (c: Candidate) => void)(row as Candidate)} />
        <span data-testid="row-name">{row?.name ?? ''}</span>
      </div>
    )
  },
}))

// useCandidatesData backed by REAL useState (mirrors the usePageMemory mock below)
// so setCandidates from CandidatesPage's optimistic merge + REFRESH-FIX-2 reconcile
// actually reaches the list row this test reads back out.
vi.mock('./hooks/useCandidatesData', () => ({
  CANDIDATES_MAX_PER_PAGE: 200,
  useCandidatesData: () => {
    const [candidates, setCandidates] = useState<Candidate[]>([seedCandidate])
    const [total, setTotal] = useState(1)
    return {
      candidates, setCandidates, loading: false, error: null, total, setTotal,
      lastPage: 1, stats: null, statsFailed: false, locations: [], rowsEpoch: 0, fetching: false,
    }
  },
}))

// Bulk actions are irrelevant here — same no-op stub as the selectRace harness.
vi.mock('./hooks/useCandidateBulkActions', () => ({
  useCandidateBulkActions: () => ({
    toggleRow: vi.fn(), toggleAll: vi.fn(), bulkAddToPool: vi.fn(), bulkRemoveFromPool: vi.fn(),
    bulkSetOwner: vi.fn(), bulkSetStage: vi.fn(), bulkSetTypes: vi.fn(), bulkSetConsent: vi.fn(), bulkConvertPhase: vi.fn(),
    bulkSetStatus: vi.fn(), bulkAddTag: vi.fn(), selectedTags: [], bulkRemoveTag: vi.fn(), bulkAddNote: vi.fn(), bulkArchive: vi.fn(),
    manageByApplication: vi.fn(), bulkGeocode: vi.fn(), bulkCoupleBackoffice: vi.fn(),
    bulkArchiveGuard: null, setBulkArchiveGuard: vi.fn(), resolveBulkArchiveGuard: vi.fn(),
    bulkMergeTarget: null, bulkMergePrompt: null, resolveBulkMerge: vi.fn(),
    bulkScope: 'selection', setBulkScope: vi.fn(), resetBulkScope: vi.fn(), filteredTotal: 0,
    dialog: null,
  }),
}))

// Minimal supporting mocks — same idiom as CandidatesPage.selectRace.test.tsx.
// useCandidateDrawerActions is DELIBERATELY left real: selected/detail/patchCandidate
// are exactly the seam under test.
vi.mock('@/context/NavigationContext', () => ({ useOpenFromIntent: () => {} }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn(), reportPageFilter: vi.fn() }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [], funnelTypes: [], statuses: [], phases: [] }) }))
vi.mock('@/context/SelectionContext', () => ({ usePublishSelection: () => {} }))
vi.mock('@/lib/useGenders', () => ({ useGenders: () => ({ genders: [] }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/usePools', () => ({ usePools: () => ({ poolItems: [] }) }))
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_k: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))
vi.mock('@/hooks/useListPageSize', () => ({ useListPageSize: () => ({ pageSize: 25, setPageSize: vi.fn(), options: [25] }) }))
vi.mock('@/lib/settings/useAllSettings', () => ({ useAllSettings: () => ({}), getNumberSetting: () => 6 }))
vi.mock('@/hooks/useDrawerUrl', () => ({ useDrawerUrl: () => ({ markNextCloseReplace: vi.fn() }) }))
vi.mock('./data/candidateFilterGroups', () => ({ buildCandidateFilterGroups: () => [] }))
vi.mock('./data/candidateInsights', () => ({ buildCandidateInsights: () => ({ donuts: [], kpis: [] }) }))
vi.mock('./hooks/useCandidateFilters', () => ({
  useCandidateFilters: () => ({
    showArchived: false, setShowArchived: vi.fn(), showTrash: false, setShowTrash: vi.fn(),
    missingAppointmentFilter: false, setMissingAppointmentFilter: vi.fn(),
    selectedStatus: [], setSelectedStatus: vi.fn(), selectedPhase: [], setSelectedPhase: vi.fn(), selectedFunnel: [], setSelectedFunnel: vi.fn(),
    mapStraalActive: false, setMapStraalActive: vi.fn(),
    selectedType: [], setSelectedType: vi.fn(), selectedOwner: [], setSelectedOwner: vi.fn(),
    selectedGeslacht: [], setSelectedGeslacht: vi.fn(), selectedProvince: [], setSelectedProvince: vi.fn(),
    selectedTitle: [], setSelectedTitle: vi.fn(), selectedLocation: [], setSelectedLocation: vi.fn(),
    selectedPool: [], setSelectedPool: vi.fn(), selectedCity: [], setSelectedCity: vi.fn(),
    selectedSource: [], setSelectedSource: vi.fn(),
    globalSearch: '', setGlobalSearch: vi.fn(), attentionFilter: null, setAttentionFilter: vi.fn(),
    dateRange: null, setDateRange: vi.fn(), geoFilter: null, geoHint: null, applyGeo: vi.fn(), clearGeo: vi.fn(),
    anyFilterActive: false, clearAllFilters: vi.fn(), searchEpoch: 0, filterParams: {}, filterKey: 'k1',
  }),
}))
vi.mock('./hooks/useCandidateOptions', () => ({
  useCandidateOptions: () => ({
    statusOptions: [], funnelOptions: [], typeOptions: [], ownerOptions: [], genderOptions: [], provinceOptions: [],
    titleOptions: [], locationOptions: [], statusData: [], funnelData: [], rcData: [],
    staleCount: 0, neverContactedCount: 0, noFollowupCount: 0, intakeCount: 0, activeConvCount: 0, tasksCount: 0,
  }),
}))
vi.mock('./CandidateLifecycleModals', () => ({ default: () => null }))
vi.mock('./AddCandidateModal', () => ({ default: () => null }))

describe('CandidatesPage · REFRESH-FIX-2-PAGETEST-1', () => {
  it('adopts the server-mapped name into selected + the list row, without clobbering an unreturned key', async () => {
    // The "gone" GET the drawer fires on open never resolves usefully here — reject
    // it so `detail` stays null and `candidate={detail ?? selected}` is `selected`.
    apiGet.mockRejectedValue(new Error('not needed for this test'))
    // The PATCH response's mapped body — REFRESH-FIX-2's own example (a name
    // recomposed server-side). Deliberately carries no `firstname`.
    apiPatch.mockResolvedValue({ data: { data: { id: 'c1', name: 'Server Name' } } })

    render(<CandidatesPage intent={{}} />)

    // Open the seeded candidate's drawer.
    fireEvent.click(screen.getByLabelText('open-c1'))
    await waitFor(() => expect(screen.getByTestId('drawer-name').textContent).toBe('Client Name'))

    // Drive the captured onUpdate exactly as the drawer's header-name save does
    // (useCandidateHeaderEdit.ts): the full patch, including the optimistic `name`.
    const onUpdate = lastDrawerProps.onUpdate as (id: string, patch: Record<string, unknown>) => Promise<boolean>
    await act(async () => { await onUpdate('c1', { firstname: 'Client', name: 'Client Name' }) })

    expect(apiPatch).toHaveBeenCalledWith('/candidates/c1', { first_name: 'Client' })

    // Server-composed name replaces the optimistic value in BOTH the open drawer…
    await waitFor(() => expect(screen.getByTestId('drawer-name').textContent).toBe('Server Name'))
    // …and the matching list row.
    expect(screen.getByTestId('row-name').textContent).toBe('Server Name')

    // REFRESH-FIX-2 guard: `firstname` was patched but the mocked server response
    // never carried it back — it must keep its optimistic value, never `undefined`.
    const drawerCandidate = lastDrawerProps.candidate as Candidate
    expect(drawerCandidate.firstname).toBe('Client')
    const tableRows = lastTableProps.rows as Candidate[]
    expect(tableRows.find(r => r.id === 'c1')?.firstname).toBe('Client')
  })
})
