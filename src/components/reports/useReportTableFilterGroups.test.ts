/**
 * useReportTableFilterGroups.test — the two toggle closures add/remove a value
 * from the selection (mirrors the inline closures DepartmentsTable/LocationsTable
 * used to redeclare), and the group shape matches buildReportFilterGroups.
 */
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { useReportTableFilterGroups } from './useReportTableFilterGroups'

const mockT = ((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key) as unknown as TFunction

const CONFIG = {
  customerLabelKey: 'test.customer',
  statusLabelKey: 'test.status',
  customerFieldKey: 'customer_id',
  statusFieldKey: 'status',
}

// Harness mirrors a real consumer: the selection lives in real useState so the
// toggle closures' add/remove behaviour is exercised end to end.
function useHarness() {
  const [selectedCustomers, setSelectedCustomers] = useState<Array<string | number>>([])
  const [selectedStatuses, setSelectedStatuses] = useState<Array<string | number>>([])
  const rows = [{ customer_id: 1, status: 'active' }, { customer_id: 2, status: 'inactive' }]
  const groups = useReportTableFilterGroups({
    t: mockT, rows,
    customerOptions: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    statusOptions: ['active', 'inactive'],
    selectedCustomers, setSelectedCustomers,
    selectedStatuses, setSelectedStatuses,
    config: CONFIG,
  })
  return { groups, selectedCustomers, selectedStatuses }
}

describe('useReportTableFilterGroups', () => {
  it('builds the customer and status groups via the shared builder', () => {
    const { result } = renderHook(() => useHarness())
    expect(result.current.groups).toHaveLength(2)
    expect(result.current.groups[0].key).toBe('customer')
    expect(result.current.groups[1].key).toBe('status')
  })

  it('onToggle adds a value the first time and removes it the second time', () => {
    const { result } = renderHook(() => useHarness())

    act(() => { (result.current.groups[0].onToggle as (v: string | number) => void)(1) })
    expect(result.current.selectedCustomers).toEqual([1])

    act(() => { (result.current.groups[0].onToggle as (v: string | number) => void)(1) })
    expect(result.current.selectedCustomers).toEqual([])
  })

  it('the two dimensions toggle independently', () => {
    const { result } = renderHook(() => useHarness())

    act(() => { (result.current.groups[1].onToggle as (v: string | number) => void)('active') })
    expect(result.current.selectedStatuses).toEqual(['active'])
    expect(result.current.selectedCustomers).toEqual([])
  })
})
