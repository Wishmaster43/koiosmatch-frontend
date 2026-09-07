/**
 * reportTableCells — shared cell renderers for report tables (Customers, Locations, Departments).
 * Each renderer returns JSX for a table cell (typically wrapped in <td style={TD}>...)</td>).
 */
import { ReactNode } from 'react'
import StatusBadge from '../ui/StatusBadge'

/**
 * Renders a status badge cell (active/inactive/other).
 * Consumers: CustomersTable (c.status), LocationsTable (r.status)
 */
export function renderStatusCell(status?: string | null): ReactNode {
  if (!status) return null
  return <StatusBadge status={status} />
}


/**
 * Renders a count cell with numeric value and — fallback for zero.
 * Consumers: CustomersTable (locCount, deptCount), LocationsTable (dept_count)
 */
export function renderCountCell(count: number | undefined | null): ReactNode {
  const numCount = count ?? 0
  if (numCount === 0) {
    return (
      <>
        <span style={{ fontWeight: 500 }}>0</span>
        <span style={{ color: 'var(--border)', marginLeft: 4, fontSize: 11 }}>—</span>
      </>
    )
  }
  return <span style={{ fontWeight: 500 }}>{numCount}</span>
}

/**
 * Renders a monospace cell (ID, code) with — fallback for missing value.
 * Consumers: CustomersTable (debtor_number), DepartmentsTable (cost_center)
 */
export function renderMonospaceCell(value: string | undefined | null): ReactNode {
  if (!value) return <span style={{ color: 'var(--border)' }}>—</span>
  return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{value}</span>
}
