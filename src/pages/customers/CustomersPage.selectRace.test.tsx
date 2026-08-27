/**
 * CustomersPage · SELECT-RACE-PAGETEST-1 — pins the page-level wiring the
 * DataTable harness test can't: (1) the epoch-clear effect actually depends on
 * `rowsEpoch` from useCustomersData, so a NEW server result landing while a row
 * is selected clears that selection; (2) `selectionBusy` (fetching from the same
 * hook) really reaches CustomersTable. Both would silently pass the harness test
 * even if the page dropped `rowsEpoch` from its effect deps or stopped passing
 * `selectionBusy` — this test drives the real page, not a re-implementation.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CustomersPage from './CustomersPage'

// Captures the exact props CustomersPage passes to CustomersTable.
let lastTableProps: Record<string, unknown> = {}
vi.mock('./CustomersTable', () => ({
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

// Mutable across renders — rowsEpoch/fetching drive the two assertions below.
const dataHookState = vi.hoisted(() => ({ rowsEpoch: 0, fetching: false }))
vi.mock('./hooks/useCustomersData', () => ({
  CUSTOMERS_MAX_PER_PAGE: 200,
  useCustomersData: () => ({
    customers: [], setCustomers: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
    lastPage: 1, stats: null, refresh: vi.fn(),
    rowsEpoch: dataHookState.rowsEpoch, fetching: dataHookState.fetching,
  }),
}))

// Real toggleRow wired through the page's own setSelectedIds — every other
// bulk action stays a no-op stub, this test only exercises selection.
vi.mock('./hooks/useCustomerBulkActions', () => ({
  useCustomerBulkActions: (args: { setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void }) => ({
    toggleRow: (id: string) => args.setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n }),
    toggleAll: vi.fn(), bulkSetOwner: vi.fn(), bulkSetStatus: vi.fn(),
    bulkAddTag: vi.fn(), bulkRemoveTag: vi.fn(), bulkAddNote: vi.fn(), bulkArchive: vi.fn(),
    bulkGeocode: vi.fn(), bulkCoupleBackoffice: vi.fn(), selectedTags: [], dialog: null,
  }),
}))
vi.mock('./hooks/useCustomerRecord', () => ({
  useCustomerRecord: () => ({
    selected: null, detail: null, drawerExpanded: false, setDrawerExpanded: vi.fn(), drawerTab: undefined,
    closeDrawer: vi.fn(), selectCustomer: vi.fn(), updateCustomer: vi.fn(), restoreCustomer: vi.fn(),
    handleCreate: vi.fn(), addNote: vi.fn(), editNote: vi.fn(), deleteNote: vi.fn(),
    fetchPreviousVersion: vi.fn(), restorePreviousVersion: vi.fn(),
  }),
}))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})
vi.mock('@/lib/useCustomerLookups', () => ({
  useCustomerLookups: () => ({
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex mirroring the real hook's own neutral-fallback colour, not a UI choice
    statuses: [], statusMeta: () => ({ value: '', label: '—', color: '#9CA3AF' }),
    locationStatuses: [], departmentStatuses: [], contactStatuses: [],
  }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { branch_ids: [] }, hasPermission: () => true }) }))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn(), reportPageFilter: vi.fn() }),
}))

describe('CustomersPage · SELECT-RACE-PAGETEST-1', () => {
  it('clears the selection when a NEW rowsEpoch arrives from useCustomersData', () => {
    dataHookState.rowsEpoch = 0
    dataHookState.fetching = false
    const { rerender } = render(<CustomersPage />)

    fireEvent.click(screen.getByLabelText('select-row-c1'))
    expect(screen.getByTestId('selected-count').textContent).toBe('1')

    // A new server result lands — rowsEpoch bumps, same filter/page/pageSize.
    dataHookState.rowsEpoch = 1
    rerender(<CustomersPage />)
    expect(screen.getByTestId('selected-count').textContent).toBe('0')
  })

  it('forwards fetching from useCustomersData as selectionBusy to the table', () => {
    dataHookState.rowsEpoch = 2
    dataHookState.fetching = true
    render(<CustomersPage />)
    expect(lastTableProps.selectionBusy).toBe(true)
  })
})
