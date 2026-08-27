/**
 * ApplicationsPage · SELECT-RACE-PAGETEST-1 — pins the page-level wiring the
 * DataTable harness test can't: (1) the epoch-clear effect actually depends on
 * `rowsEpoch` from useApplicationsData, so a NEW server result landing while a
 * row is selected clears that selection; (2) `selectionBusy` (fetching from the
 * same hook) really reaches ApplicationsTable. Both would silently pass the
 * harness test even if the page dropped `rowsEpoch` from its effect deps or
 * stopped passing `selectionBusy` — this test drives the real page.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import ApplicationsPage from './ApplicationsPage'

// Captures the exact props ApplicationsPage passes to ApplicationsTable.
let lastTableProps: Record<string, unknown> = {}
vi.mock('./ApplicationsTable', () => ({
  default: (props: Record<string, unknown>) => {
    lastTableProps = props
    const ids = props.selectedIds as Set<string>
    return (
      <div>
        <button aria-label="select-row-a1" onClick={() => (props.onToggleRow as (id: string) => void)('a1')} />
        <span data-testid="selected-count">{ids.size}</span>
      </div>
    )
  },
}))

// Mutable across renders — rowsEpoch/fetching drive the two assertions below.
const dataHookState = vi.hoisted(() => ({ rowsEpoch: 0, fetching: false }))
vi.mock('./hooks/useApplicationsData', () => ({
  APPLICATIONS_MAX_PER_PAGE: 200,
  useApplicationsData: () => ({
    applications: [], setApplications: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
    lastPage: 1, wideRows: [], wideLoading: false, wideError: null, wideIsPartial: false,
    stats: null, statsFailed: false,
    rowsEpoch: dataHookState.rowsEpoch, fetching: dataHookState.fetching,
  }),
}))

// Real toggleRow wired through the page's own setSelectedIds — every other
// bulk action stays a no-op stub, this test only exercises selection.
vi.mock('./hooks/useApplicationBulkActions', () => ({
  useApplicationBulkActions: (args: { setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void }) => ({
    toggleRow: (id: string) => args.setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n }),
    toggleAll: vi.fn(), bulkSetPhase: vi.fn(), bulkDetach: vi.fn(),
  }),
}))
vi.mock('./hooks/useApplicationDrawerActions', () => ({
  useApplicationDrawerActions: () => ({
    selected: null, expanded: false, setExpanded: vi.fn(), closeDrawer: vi.fn(), selectApplication: vi.fn(), openTab: vi.fn(),
    handleMove: vi.fn(), handleOwner: vi.fn(), handleLinkVacancy: vi.fn(), handleUpdateSource: vi.fn(),
    handleReject: vi.fn(), handleAdjustScore: vi.fn(), handleUpdateCustomFields: vi.fn(),
    handleCandidateUpdated: vi.fn(), handleDetach: vi.fn(), handleRestore: vi.fn(),
    pendingMove: null, confirmPendingMove: vi.fn(), cancelPendingMove: vi.fn(),
  }),
}))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn(), reportPageFilter: vi.fn() }),
}))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ funnelTypes: [], funnelMeta: () => ({ label: '', color: '#000' }) }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useBranchOptions', () => ({ useBranchOptions: () => [] }))
vi.mock('@/context/NavigationContext', () => ({ useOpenFromIntent: () => {} }))
vi.mock('@/hooks/useDrawerUrl', () => ({ useDrawerUrl: () => {} }))
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_k: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))
vi.mock('@/hooks/useListPageSize', () => ({ useListPageSize: () => ({ pageSize: 25, setPageSize: vi.fn(), options: [25] }) }))
vi.mock('./ApplicationsBoard', () => ({ default: () => null }))
vi.mock('./ApplicationDrawer', () => ({ default: () => null }))
vi.mock('./ApplicationsBulkBar', () => ({ default: () => null }))
vi.mock('./AddApplicationModal', () => ({ default: () => null }))
vi.mock('./PhaseChangeAppointmentWarning', () => ({ default: () => null }))
vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))

describe('ApplicationsPage · SELECT-RACE-PAGETEST-1', () => {
  it('clears the selection when a NEW rowsEpoch arrives from useApplicationsData', () => {
    dataHookState.rowsEpoch = 0
    dataHookState.fetching = false
    const { rerender } = render(<ApplicationsPage />)

    fireEvent.click(screen.getByLabelText('select-row-a1'))
    expect(screen.getByTestId('selected-count').textContent).toBe('1')

    // A new server result lands — rowsEpoch bumps, same filters/page/pageSize.
    dataHookState.rowsEpoch = 1
    rerender(<ApplicationsPage />)
    expect(screen.getByTestId('selected-count').textContent).toBe('0')
  })

  it('forwards fetching from useApplicationsData as selectionBusy to the table', () => {
    dataHookState.rowsEpoch = 2
    dataHookState.fetching = true
    render(<ApplicationsPage />)
    expect(lastTableProps.selectionBusy).toBe(true)
  })
})
