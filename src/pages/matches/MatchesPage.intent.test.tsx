/**
 * MatchesPage · intent seam (contract_form / contract_type / pendingApprovalOnly).
 * §13: asserts the DESTINATION — intents narrow the same rows the table receives,
 * mirroring the stage/owner assertions in MatchesPage.filterPanel.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@/i18n'
import MatchesPage from './MatchesPage'
import { __resetPageMemoryForTests } from '@/lib/usePageMemory'

// The rendered tree fires lookup requests this test never awaits; the real client would reject them with a
// network error AFTER the last test and log "API Error" during worker teardown, which vitest 5 counts as an
// unhandled error. The stub rejects the same way (error state stays identical) without the client's logging.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const offline = () => Promise.reject(new Error('network disabled in this test'))
  return { ...actual, default: { get: vi.fn(offline), post: vi.fn(offline), put: vi.fn(offline), patch: vi.fn(offline), delete: vi.fn(offline), request: vi.fn(offline) } }
})

vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: () => {}, unregisterFilters: () => {} }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { default_per_page: 50 }, hasPermission: () => true }) }))
vi.mock('@/lib/useMatchStatuses', () => ({
  useMatchStatuses: () => ({
    statuses: [{ value: 'open', label: 'Open' }],
    metaOf: (v: string) => ({ label: v, color: '#000', is_closed: false }),
  }),
}))
vi.mock('./hooks/useMatchApprovalMode', () => ({ useMatchApprovalMode: () => ({ approvalMode: 'altijd' }) }))
// Real lookup vocabulary (§ MATCH-AXIS-FIX): options carry {value,label} so the
// predicate can tolerate rows written with either form (see VOCABULARY CAVEAT).
vi.mock('@/lib/useContractTypes', () => ({
  useContractTypes: () => ({
    types: ['Uitzendbeding', 'ZZP'],
    options: [
      { value: 'uitzendbeding', label: 'Uitzendbeding', default_duration_days: null, is_default: false },
      { value: 'zzp', label: 'ZZP', default_duration_days: null, is_default: false },
    ],
  }),
}))

// Rows with distinct contract forms AND contract types — enough to prove both
// intents narrow the set. m-3 exercises the label/value tolerance: its
// contractType is the LOOKUP LABEL ('Uitzendbeding'), as the drawer writes it.
const rows = [
  { id: 'm-1', candidate: 'Jane Doe', vacancy: 'Verpleegkundige', client: 'Acme', owner: 'Jane', status: 'open', archived: false, contractForm: { value: 'zzp', label: 'ZZP', color: '#000' }, contractType: 'zzp' },
  { id: 'm-2', candidate: 'John Roe', vacancy: 'Verzorgende IG', client: 'Beta', owner: 'John', status: 'open', archived: false, contractForm: { value: 'flex', label: 'Flex', color: '#000' }, contractType: 'detachering' },
  { id: 'm-3', candidate: 'Ann Poe', vacancy: 'Verzorgende IG', client: 'Gamma', owner: 'John', status: 'open', archived: false, contractForm: { value: 'flex', label: 'Flex', color: '#000' }, contractType: 'Uitzendbeding' },
]
const spyUseMatches = vi.hoisted(() => vi.fn())
vi.mock('./hooks/useMatches', () => ({
  useMatches: (...args: unknown[]) => (spyUseMatches(...args), { rows, loading: false, error: false, updateMatch: vi.fn(), reload: vi.fn() }),
  mapMatch: (r: unknown) => r,
  MATCHES_MAX_PER_PAGE: 200,
}))
vi.mock('./hooks/useMatchesBulkActions', () => ({
  useMatchesBulkActions: () => ({ toggleRow: vi.fn(), toggleAll: vi.fn(), bulkCoupleHelloFlex: vi.fn(), bulkCoupleShiftmanager: vi.fn() }),
}))
vi.mock('./hooks/useMatchArchive', () => ({ useMatchArchive: () => ({ archiveMatch: vi.fn(), restoreMatch: vi.fn(), dialog: null }) }))
vi.mock('./hooks/useMatchMutations', () => ({ useMatchMutations: () => ({ setStatus: vi.fn(), setOwner: vi.fn(), updateCustomFields: vi.fn() }) }))

vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('./MatchesBoard', () => ({ default: () => null }))
vi.mock('./MatchesBulkBar', () => ({ default: () => null }))
vi.mock('@/components/ui/PaginationBar', () => ({ default: () => null, PAGE_SIZE_OPTIONS: [50, 100, 200, 300, 400, 500] }))
vi.mock('@/components/ui/HeaderSearch', () => ({ default: () => null }))
vi.mock('@/components/ui/ClearFiltersButton', () => ({ default: () => null }))
vi.mock('@/components/ui/QuickViewToggle', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewModeToggle', () => ({ default: () => null }))
vi.mock('@/pages/candidates/drawer/MatchModal', () => ({ default: () => null }))
vi.mock('@/components/ui/ViewSwitch', () => ({
  default: ({ views }: { views: Array<{ render: () => unknown }> }) => <>{views[0]?.render()}</>,
}))
vi.mock('./MatchDrawer', () => ({ default: () => null }))
// Captures the exact rows the page hands the table — the DESTINATION assertion target.
vi.mock('./MatchesTable', () => ({
  default: ({ rows: tableRows }: { rows: Array<{ id: string }> }) => (
    <div data-testid="table-rows">{tableRows.map(r => r.id).join(',')}</div>
  ),
}))

describe('MatchesPage · contract_form intent', () => {
  // usePageMemory is a module-level store (survives across `it()` blocks by design) —
  // reset it so one test's contract-form filter never leaks into the next.
  beforeEach(() => { __resetPageMemoryForTests() })

  it('a { contract_form } intent narrows the table to the matching rows only', async () => {
    render(<MatchesPage intent={{ contract_form: 'zzp' }} />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-1'))
    expect(screen.getByTestId('table-rows')).not.toHaveTextContent('m-2')
  })

  it('arriving with no intent shows every row (contract-form filter stays empty)', async () => {
    render(<MatchesPage />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-1,m-2,m-3'))
  })

  it('a { contract_type } intent narrows to rows holding the VALUE only', async () => {
    render(<MatchesPage intent={{ contract_type: 'zzp' }} />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-1'))
    expect(screen.getByTestId('table-rows')).not.toHaveTextContent('m-2')
    expect(screen.getByTestId('table-rows')).not.toHaveTextContent('m-3')
  })

  it('a { contract_type } intent also matches a row written with the lookup LABEL (vocabulary tolerance)', async () => {
    render(<MatchesPage intent={{ contract_type: 'uitzendbeding' }} />)
    await waitFor(() => expect(screen.getByTestId('table-rows')).toHaveTextContent('m-3'))
    expect(screen.getByTestId('table-rows')).not.toHaveTextContent('m-1')
    expect(screen.getByTestId('table-rows')).not.toHaveTextContent('m-2')
  })
})

// ONIX S-004: the expiring horizon reaches the data hook (which sends the GET /matches params).
describe('MatchesPage · expiring intent', () => {
  it('forwards { expiring_within_days, expiring_within_unit } to useMatches', () => {
    spyUseMatches.mockClear()
    render(<MatchesPage intent={{ expiring_within_days: 1, expiring_within_unit: 'months' }} />)
    expect(spyUseMatches).toHaveBeenCalledWith(null, false, undefined, { days: 1, unit: 'months' })
  })
})
