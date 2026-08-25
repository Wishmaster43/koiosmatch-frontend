/**
 * CandidatesPage — cross-page deep-link seam (WHATSAPP-PAGINA-ONDERZOEK-1, 25-08).
 * `openEntity('candidates', id, 'communication:conversations')` arrives as
 * `{ open, tab }`; the page's useOpenFromIntent callback used to drop the tab,
 * so a conversation link could never land on Communicatie › Conversaties. §13:
 * this asserts the DESTINATION call (selectCandidate receives the tab), not
 * merely that a callback fired.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useState } from 'react'
import CandidatesPage from './CandidatesPage'

// Capture the callback the page hands to useOpenFromIntent — the seam under test.
let openById: ((id: string, tab?: string) => void) | null = null
vi.mock('@/context/NavigationContext', () => ({
  useOpenFromIntent: (_intent: unknown, cb: (id: string, tab?: string) => void) => { openById = cb },
}))
const selectCandidate = vi.fn()
vi.mock('./hooks/useCandidateDrawerActions', () => ({
  useCandidateDrawerActions: () => ({
    selected: null, setSelected: vi.fn(), detail: null, setDetail: vi.fn(), drawerExpanded: false, setDrawerExpanded: vi.fn(),
    drawerTab: undefined, selectCandidate, closeDrawer: vi.fn(), patchCandidate: vi.fn(), refreshRecord: vi.fn(),
    archiveOne: vi.fn(), restoreOne: vi.fn(), markDeletionOne: vi.fn(),
    archiveGuard: null, setArchiveGuard: vi.fn(), resolveArchiveGuard: vi.fn(),
    eraseTarget: null, setEraseTarget: vi.fn(), hardDeleteOne: vi.fn(), confirmHardDelete: vi.fn(),
    dialog: null,
  }),
}))

// Everything else is stubbed to the minimum the container needs to mount.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn() }) }))
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
    anyFilterActive: false, clearAllFilters: vi.fn(), searchEpoch: 0, filterParams: {}, filterKey: '',
  }),
}))
vi.mock('./hooks/useCandidatesData', () => ({
  CANDIDATES_MAX_PER_PAGE: 200,
  useCandidatesData: () => ({
    candidates: [], setCandidates: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
    lastPage: 1, stats: null, statsFailed: false, locations: [], rowsEpoch: 0, fetching: false,
  }),
}))
vi.mock('./hooks/useCandidateOptions', () => ({
  useCandidateOptions: () => ({
    statusOptions: [], funnelOptions: [], typeOptions: [], ownerOptions: [], genderOptions: [], provinceOptions: [],
    titleOptions: [], locationOptions: [], statusData: [], funnelData: [], rcData: [],
    staleCount: 0, neverContactedCount: 0, noFollowupCount: 0, intakeCount: 0, activeConvCount: 0, tasksCount: 0,
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
vi.mock('./CandidateDrawer', () => ({ default: () => null }))
vi.mock('./CandidateLifecycleModals', () => ({ default: () => null }))
vi.mock('./AddCandidateModal', () => ({ default: () => null }))
vi.mock('./CandidatesListPanel', () => ({ default: () => null }))

describe('CandidatesPage · cross-page deep-link tab seam', () => {
  it('forwards the intent tab into selectCandidate (a conversation link lands on its sub-tab)', () => {
    render(<CandidatesPage intent={{}} />)
    expect(openById).not.toBeNull()
    openById!('c-1', 'communication:conversations')
    expect(selectCandidate).toHaveBeenCalledWith({ id: 'c-1' }, 'communication:conversations')
  })

  it('a plain { open } link still opens on the default tab (tab undefined, never a fabricated one)', () => {
    selectCandidate.mockClear()
    render(<CandidatesPage intent={{}} />)
    openById!('c-2')
    expect(selectCandidate).toHaveBeenCalledWith({ id: 'c-2' }, undefined)
  })
})
