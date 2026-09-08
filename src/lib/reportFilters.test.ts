import { describe, it, expect } from 'vitest'
import { buildReportFilterGroups } from './reportFilters'
import type { TFunction } from 'i18next'

describe('buildReportFilterGroups', () => {
  const mockT = ((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || key) as unknown as TFunction

  const rows = [
    { customer_id: 1, status: 'active' },
    { customer_id: 1, status: 'inactive' },
    { customer_id: 2, status: 'active' },
  ]

  it('builds customer and status filter groups', () => {
    const customerOptions = [
      { id: 1, name: 'Customer A' },
      { id: 2, name: 'Customer B' },
    ]
    const statusOptions = ['active', 'inactive']

    const result = buildReportFilterGroups({
      t: mockT,
      rows,
      customerOptions,
      statusOptions,
      selectedCustomers: [],
      selectedStatuses: [],
      onToggleCustomer: () => {},
      onToggleStatus: () => {},
      config: {
        customerLabelKey: 'test.customer',
        statusLabelKey: 'test.status',
        customerFieldKey: 'customer_id',
        statusFieldKey: 'status',
      },
    })

    expect(result).toHaveLength(2)
    expect(result[0].key).toBe('customer')
    expect(result[1].key).toBe('status')
  })

  it('includes correct counts per option', () => {
    const customerOptions = [
      { id: 1, name: 'Customer A' },
      { id: 2, name: 'Customer B' },
    ]
    const statusOptions = ['active', 'inactive']

    const result = buildReportFilterGroups({
      t: mockT,
      rows,
      customerOptions,
      statusOptions,
      selectedCustomers: [],
      selectedStatuses: [],
      onToggleCustomer: () => {},
      onToggleStatus: () => {},
      config: {
        customerLabelKey: 'test.customer',
        statusLabelKey: 'test.status',
        customerFieldKey: 'customer_id',
        statusFieldKey: 'status',
      },
    })

    expect(result[0].options[0].count).toBe(2) // customer 1: 2 rows
    expect(result[0].options[1].count).toBe(1) // customer 2: 1 row
    expect(result[1].options[0].count).toBe(2) // active: 2 rows
    expect(result[1].options[1].count).toBe(1) // inactive: 1 row
  })

  it('translates status labels correctly', () => {
    const statusT = ((key: string) => {
      if (key === 'common.statusActive') return 'Active'
      if (key === 'common.statusInactive') return 'Inactive'
      return key
    }) as unknown as TFunction

    const customerOptions = [{ id: 1, name: 'Customer A' }]
    const statusOptions = ['active', 'inactive']

    const result = buildReportFilterGroups({
      t: statusT,
      rows,
      customerOptions,
      statusOptions,
      selectedCustomers: [],
      selectedStatuses: [],
      onToggleCustomer: () => {},
      onToggleStatus: () => {},
      config: {
        customerLabelKey: 'test.customer',
        statusLabelKey: 'test.status',
        customerFieldKey: 'customer_id',
        statusFieldKey: 'status',
      },
    })

    expect(result[1].options[0].label).toBe('Active')
    expect(result[1].options[1].label).toBe('Inactive')
  })
})
