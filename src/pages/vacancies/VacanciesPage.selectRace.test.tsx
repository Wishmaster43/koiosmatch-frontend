/**
 * VacanciesPage · SELECT-RACE-PAGETEST-1 — pins the page-level wiring the
 * DataTable harness test can't: (1) the epoch-clear effect actually depends on
 * `rowsEpoch` from useVacanciesData, so a NEW server result landing while a row
 * is selected clears that selection; (2) `selectionBusy` (fetching from the
 * same hook) really reaches VacanciesTable. Both would silently pass the
 * harness test even if the page dropped `rowsEpoch` from its effect deps or
 * stopped passing `selectionBusy` — this test drives the real page.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import VacanciesPage from './VacanciesPage'

// Captures the exact props VacanciesPage passes to VacanciesTable.
let lastTableProps: Record<string, unknown> = {}
vi.mock('./VacanciesTable', () => ({
  default: (props: Record<string, unknown>) => {
    lastTableProps = props
    const ids = props.selectedIds as Set<string>
    return (
      <div>
        <button aria-label="select-row-v1" onClick={() => (props.onToggleRow as (id: string) => void)('v1')} />
        <span data-testid="selected-count">{ids.size}</span>
      </div>
    )
  },
}))

// Mutable across renders — rowsEpoch/fetching drive the two assertions below.
const dataHookState = vi.hoisted(() => ({ rowsEpoch: 0, fetching: false }))
vi.mock('./hooks/useVacanciesData', () => ({
  VACANCIES_MAX_PER_PAGE: 200,
  useVacanciesData: () => ({
    vacancies: [], setVacancies: vi.fn(), loading: false, error: null, total: 0, setTotal: vi.fn(),
    lastPage: 1, stats: null, customers: [], refresh: vi.fn(),
    rowsEpoch: dataHookState.rowsEpoch, fetching: dataHookState.fetching,
  }),
}))

// Real toggleRow wired through the page's own setSelectedIds — every other
// bulk action stays a no-op stub, this test only exercises selection.
vi.mock('./hooks/useVacancyBulkActions', () => ({
  useVacancyBulkActions: (args: { setSelectedIds: (fn: (prev: Set<string>) => Set<string>) => void }) => ({
    toggleRow: (id: string) => args.setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n }),
    toggleAll: vi.fn(), bulkSetOwner: vi.fn(), bulkSetStatus: vi.fn(), bulkSetClient: vi.fn(), bulkPublish: vi.fn(),
    bulkSetAiAgent: vi.fn(), bulkRemoveTag: vi.fn(), bulkAddNote: vi.fn(), bulkArchive: vi.fn(),
    selectedTags: [], dialog: null,
  }),
}))
vi.mock('./hooks/useVacancyRecord', () => ({
  useVacancyRecord: () => ({
    selected: null, detail: null, drawerExpanded: false, setDrawerExpanded: vi.fn(), closeDrawer: vi.fn(),
    selectVacancy: vi.fn(), handleCreated: vi.fn(), updateVacancy: vi.fn(), restoreVacancy: vi.fn(),
  }),
}))
vi.mock('./hooks/useVacancyInsights', () => ({
  useVacancyInsights: () => ({ statusData: [], ownerData: [], clientData: [], publishedData: [], categoryData: [], funnelData: [], agentData: [], applicationsTotal: 0 }),
}))
vi.mock('./hooks/useAiAgents', () => ({ useAiAgents: () => ({ options: [] }) }))
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters: vi.fn(), unregisterFilters: vi.fn(), reportPageFilter: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('@/lib/useBranchOptions', () => ({ useBranchOptions: () => [] }))
vi.mock('@/context/VacancyLookupsContext', () => ({
  VacancyLookupsProvider: ({ children }: { children: React.ReactNode }) => children,
  useVacancyLookups: () => ({ statuses: [], phases: [], statusMeta: () => ({ label: '', color: '#000' }) }),
}))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ navigate: vi.fn() }), useOpenFromIntent: () => {} }))
vi.mock('@/hooks/useDrawerUrl', () => ({ useDrawerUrl: () => {} }))
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_k: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))
vi.mock('@/hooks/useListPageSize', () => ({ useListPageSize: () => ({ pageSize: 25, setPageSize: vi.fn(), options: [25] }) }))
vi.mock('@/components/insights/InsightsRow', () => ({ default: () => null }))
vi.mock('./VacanciesBulkBar', () => ({ default: () => null }))
vi.mock('./VacancyDrawer', () => ({ default: () => null }))
vi.mock('./AddVacancyModal', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }), initReactI18next: { type: '3rdParty', init: () => {} } }))

describe('VacanciesPage · SELECT-RACE-PAGETEST-1', () => {
  it('clears the selection when a NEW rowsEpoch arrives from useVacanciesData', () => {
    dataHookState.rowsEpoch = 0
    dataHookState.fetching = false
    const { rerender } = render(<VacanciesPage />)

    fireEvent.click(screen.getByLabelText('select-row-v1'))
    expect(screen.getByTestId('selected-count').textContent).toBe('1')

    // A new server result lands — rowsEpoch bumps, same filter/page/pageSize.
    dataHookState.rowsEpoch = 1
    rerender(<VacanciesPage />)
    expect(screen.getByTestId('selected-count').textContent).toBe('0')
  })

  it('forwards fetching from useVacanciesData as selectionBusy to the table', () => {
    dataHookState.rowsEpoch = 2
    dataHookState.fetching = true
    render(<VacanciesPage />)
    expect(lastTableProps.selectionBusy).toBe(true)
  })
})
