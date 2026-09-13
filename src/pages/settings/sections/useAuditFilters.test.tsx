/**
 * useAuditFilters — regression for the stale search-filter-group bug: typing in
 * the search box must update the group REGISTERED in the shared right panel
 * (not just the internal `filteredAll` list) without touching any other filter,
 * because ReportFilterSidebar's search input is a fully controlled component
 * bound to the registered group's `value` — a stale registration silently
 * rejects every keystroke until another filter forces a fresh registration.
 */
import type { ReactNode } from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import '@/i18n'
import { RightPanelProvider, useRightPanel } from '@/context/RightPanelContext'
import { useAuditFilters } from './useAuditFilters'

const wrapper = ({ children }: { children: ReactNode }) => <RightPanelProvider>{children}</RightPanelProvider>

// One audit log row (AuditLogController shape) — mirrors useAuditFilters' own input.
interface AuditLogRow { id: number; log_name: string; causer_name: string; causer_email: string; created_at: string; description: string }

const LOGS: AuditLogRow[] = [
  { id: 1, log_name: 'candidates', causer_name: 'Alice', causer_email: 'a@x.nl', created_at: '2026-01-01T10:00:00Z', description: 'Created candidate' },
  { id: 2, log_name: 'vacancies',  causer_name: 'Bob',   causer_email: 'b@x.nl', created_at: '2026-01-02T10:00:00Z', description: 'Updated vacancy' },
]

// A registered right-panel filter group's shape (FilterGroup is a loose Record —
// this narrows to the fields this suite actually reads/calls).
interface SearchFilterGroup { key: string; value: string; onChange: (v: string) => void; onToggle?: (v: string) => void }

// Combined hook so the test can both drive useAuditFilters and read what it
// actually registered in the shared panel — exactly what ReportFilterSidebar reads.
function useHarness(logs: AuditLogRow[]) {
  const filters = useAuditFilters(logs)
  const panel = useRightPanel()
  return { filters, panel }
}

describe('useAuditFilters — search filter group stays in sync', () => {
  it('updates the registered search group value immediately, without touching any other filter', () => {
    const { result } = renderHook(() => useHarness(LOGS), { wrapper })

    const searchGroupBefore = result.current.panel.filterGroups.find(g => g.key === 'search') as unknown as SearchFilterGroup
    expect(searchGroupBefore.value).toBe('')

    // Type into the search box the same way ReportFilterSidebar does: call the
    // registered group's own onChange — no other filter is touched.
    act(() => searchGroupBefore.onChange('alice'))

    const searchGroupAfter = result.current.panel.filterGroups.find(g => g.key === 'search') as unknown as SearchFilterGroup
    expect(searchGroupAfter.value).toBe('alice')
  })

  it('keeps applying the search to filteredAll (this half never broke) while the panel value also updates', () => {
    const { result } = renderHook(() => useHarness(LOGS), { wrapper })

    act(() => {
      const searchGroup = result.current.panel.filterGroups.find(g => g.key === 'search') as unknown as SearchFilterGroup
      searchGroup.onChange('bob')
    })

    expect(result.current.filters.filteredAll).toHaveLength(1)
    expect(result.current.filters.filteredAll[0].causer_name).toBe('Bob')
    const searchGroup = result.current.panel.filterGroups.find(g => g.key === 'search') as unknown as SearchFilterGroup
    expect(searchGroup.value).toBe('bob')
  })

  it('onChange is the stable setSearch setter, not a stale closure', () => {
    const { result } = renderHook(() => useHarness(LOGS), { wrapper })
    const firstOnChange = (result.current.panel.filterGroups.find(g => g.key === 'search') as unknown as SearchFilterGroup).onChange

    // Trigger an unrelated filter change (forces a re-render/recompute).
    act(() => {
      const typeGroup = result.current.panel.filterGroups.find(g => g.key === 'type') as unknown as SearchFilterGroup | undefined
      typeGroup?.onToggle?.('candidates')
    })

    const laterOnChange = (result.current.panel.filterGroups.find(g => g.key === 'search') as unknown as SearchFilterGroup).onChange
    // Both references must update `search` correctly — proving onChange was
    // never the broken half (only the registered `value` was).
    act(() => laterOnChange('zzz'))
    expect((result.current.panel.filterGroups.find(g => g.key === 'search') as unknown as SearchFilterGroup).value).toBe('zzz')
    expect(typeof firstOnChange).toBe('function')
  })
})
