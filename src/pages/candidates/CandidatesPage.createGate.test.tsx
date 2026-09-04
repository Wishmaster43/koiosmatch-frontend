/**
 * CandidatesPage · OPENERS-HIDE-1 page-level seam — pins that the real page
 * wiring (not just CandidatesToolbar's own prop test) hides the "+ Nieuwe
 * kandidaat" opener without candidates.create. Mock harness mirrors
 * CandidatesPage.selectRace.test.tsx; CandidatesListPanel/CandidatesToolbar
 * stay real (unmocked) so the opener actually renders through the page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import CandidatesPage from './CandidatesPage'

vi.mock('./CandidatesTable', () => ({ default: () => null }))

vi.mock('./hooks/useCandidatesData', () => ({
  CANDIDATES_MAX_PER_PAGE: 200,
  useCandidatesData: () => ({
    candidates: [], setCandidates: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
    lastPage: 1, stats: null, statsFailed: false, locations: [], rowsEpoch: 0, fetching: false,
  }),
}))

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

// hasPermission stubbed via a module-level flag so a test can flip it —
// mirrors OutreachPage.test.tsx / VacanciesPage.test.tsx's idiom.
let canCreate = true
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => (p === 'candidates.create' ? canCreate : true) }) }))

// Minimal supporting mocks — same idiom as CandidatesPage.selectRace.test.tsx.
vi.mock('@/context/NavigationContext', () => ({ useOpenFromIntent: () => {} }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn(), reportPageFilter: vi.fn() }) }))
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

// hidden without the create permission (OPENERS-HIDE-1, Danny 05-09), same
// as every other page toolbar.
describe('CandidatesPage · create gate (OPENERS-HIDE-1)', () => {
  beforeEach(() => { canCreate = true })

  it('hides the opener without candidates.create', () => {
    canCreate = false
    render(<CandidatesPage intent={{}} />)
    expect(screen.queryByText('+ page.add')).toBeNull()
  })

  it('shows the opener with candidates.create', () => {
    canCreate = true
    render(<CandidatesPage intent={{}} />)
    expect(screen.getByText('+ page.add')).toBeInTheDocument()
  })
})
