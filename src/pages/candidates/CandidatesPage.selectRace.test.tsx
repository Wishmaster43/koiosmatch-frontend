/**
 * CandidatesPage · SELECT-RACE-PAGETEST-1 — pins the page-level wiring the
 * DataTable harness test can't: (1) the epoch-clear effect actually depends on
 * `rowsEpoch` from useCandidatesData, so a NEW server result landing while a row
 * is selected clears that selection; (2) `selectionBusy` (fetching from the same
 * hook) really reaches the table's select-all control. Both would silently pass
 * the harness test even if a page dropped `rowsEpoch` from its effect deps or
 * stopped passing `selectionBusy` — this test fails in exactly that case because
 * it drives the real page, not a re-implementation of the guard.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import CandidatesPage from './CandidatesPage'

// Captures the exact props CandidatesPage → CandidatesListPanel → CandidatesTable
// receives, so the test can assert selectionBusy/selectedIds without re-deriving
// them from the harness. CandidatesListPanel itself stays real (unmocked).
let lastTableProps: Record<string, unknown> = {}
vi.mock('./CandidatesTable', () => ({
  default: (props: Record<string, unknown>) => {
    lastTableProps = props
    const ids = props.selectedIds as Set<string>
    return (
      <div>
        <button aria-label="select-row-c1" onClick={() => (props.onToggleRow as (id: string) => void)('c1')} />
        <span data-testid="selected-count">{ids.size}</span>
      </div>
    )
  },
}))

// The mocked data hook is mutable across renders — rowsEpoch/fetching drive the
// two assertions below (bump epoch ⇒ clear; toggle fetching ⇒ selectionBusy passthrough).
const dataHookState = vi.hoisted(() => ({ rowsEpoch: 0, fetching: false }))
vi.mock('./hooks/useCandidatesData', () => ({
  CANDIDATES_MAX_PER_PAGE: 200,
  useCandidatesData: () => ({
    candidates: [], setCandidates: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
    lastPage: 1, stats: null, statsFailed: false, locations: [],
    rowsEpoch: dataHookState.rowsEpoch, fetching: dataHookState.fetching,
  }),
}))

// Real toggleRow/toggleAll wired through the page's own setSelectedIds — every
// other bulk action is a no-op stub, this test only exercises selection.
vi.mock('./hooks/useCandidateBulkActions', () => ({
  useCandidateBulkActions: (args: { setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void }) => ({
    toggleRow: (id: string) => args.setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n }),
    toggleAll: vi.fn(), bulkAddToPool: vi.fn(), bulkRemoveFromPool: vi.fn(),
    bulkSetOwner: vi.fn(), bulkSetStage: vi.fn(), bulkSetTypes: vi.fn(), bulkSetConsent: vi.fn(), bulkConvertPhase: vi.fn(),
    bulkSetStatus: vi.fn(), bulkAddTag: vi.fn(), selectedTags: [], bulkRemoveTag: vi.fn(), bulkAddNote: vi.fn(), bulkArchive: vi.fn(),
    manageByApplication: vi.fn(), bulkGeocode: vi.fn(), bulkCoupleBackoffice: vi.fn(),
    bulkArchiveGuard: null, setBulkArchiveGuard: vi.fn(), resolveBulkArchiveGuard: vi.fn(),
    bulkMergeTarget: null, bulkMergePrompt: null, resolveBulkMerge: vi.fn(),
    bulkScope: 'selection', setBulkScope: vi.fn(), resetBulkScope: vi.fn(), filteredTotal: 0,
    dialog: null,
  }),
}))

// Minimal supporting mocks — same idiom as CandidatesPage.intentTab.test.tsx.
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
vi.mock('./hooks/useCandidateDrawerActions', () => ({
  useCandidateDrawerActions: () => ({
    selected: null, setSelected: vi.fn(), detail: null, setDetail: vi.fn(), drawerExpanded: false, setDrawerExpanded: vi.fn(),
    drawerTab: undefined, selectCandidate: vi.fn(), closeDrawer: vi.fn(), patchCandidate: vi.fn(), refreshRecord: vi.fn(),
    archiveOne: vi.fn(), restoreOne: vi.fn(), markDeletionOne: vi.fn(),
    archiveGuard: null, setArchiveGuard: vi.fn(), resolveArchiveGuard: vi.fn(),
    eraseTarget: null, setEraseTarget: vi.fn(), hardDeleteOne: vi.fn(), confirmHardDelete: vi.fn(),
    dialog: null,
  }),
}))
vi.mock('./CandidateDrawer', () => ({ default: () => null }))
vi.mock('./CandidateLifecycleModals', () => ({ default: () => null }))
vi.mock('./AddCandidateModal', () => ({ default: () => null }))

describe('CandidatesPage · SELECT-RACE-PAGETEST-1', () => {
  it('clears the selection when a NEW rowsEpoch arrives from useCandidatesData', () => {
    dataHookState.rowsEpoch = 0
    dataHookState.fetching = false
    const { rerender } = render(<CandidatesPage intent={{}} />)

    fireEvent.click(screen.getByLabelText('select-row-c1'))
    expect(screen.getByTestId('selected-count').textContent).toBe('1')

    // A new server result lands — rowsEpoch bumps, same filter/page/pageSize.
    dataHookState.rowsEpoch = 1
    rerender(<CandidatesPage intent={{}} />)
    expect(screen.getByTestId('selected-count').textContent).toBe('0')
  })

  it('forwards fetching from useCandidatesData as selectionBusy to the table', () => {
    dataHookState.rowsEpoch = 2
    dataHookState.fetching = true
    render(<CandidatesPage intent={{}} />)
    expect(lastTableProps.selectionBusy).toBe(true)
  })
})
