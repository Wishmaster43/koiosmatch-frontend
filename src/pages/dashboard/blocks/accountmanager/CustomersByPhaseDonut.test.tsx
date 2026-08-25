/**
 * CustomersByPhaseDonut — asserts zero-count phases are dropped, lookup colours
 * are matched onto rows, and a slice click navigates with the phase value.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import CustomersByPhaseDonut from './CustomersByPhaseDonut'
import type { CustomerByPhaseRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// Mock lookup fixture mirrors the backend seed colours — DATA hex, not UI styling.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => ({
    phases: [
      { value: 'prospect', label: 'Prospect', color: '#1B60A9', isCustomer: false, isDefault: true },
      { value: 'klant', label: 'Klant', color: '#16A34A', isCustomer: true, isDefault: false },
    ],
  }),
}))
/* eslint-enable no-restricted-syntax */

let captured: { onItemClick?: (d: unknown) => void; data?: unknown[] } = {}
vi.mock('@/components/charts/PieChartCard', () => ({
  default: (props: typeof captured) => { captured = props; return <div data-testid="pie" /> },
}))

const rows: CustomerByPhaseRow[] = [
  { value: 'prospect', label: 'Prospect', count: 5 },
  { value: 'klant', label: 'Klant', count: 0 },
]

describe('CustomersByPhaseDonut', () => {
  it('drops zero-count phases and applies the lookup colour', () => {
    render(<CustomersByPhaseDonut rows={rows} onNavigate={vi.fn()} />)
    expect(captured.data).toHaveLength(1)
    // eslint-disable-next-line no-restricted-syntax -- asserting against the seed DATA hex above, not UI styling
    expect((captured.data![0] as Record<string, unknown>).color).toBe('#1B60A9')
  })

  it('navigates to customers filtered by phase value on click', () => {
    const onNavigate = vi.fn()
    render(<CustomersByPhaseDonut rows={rows} onNavigate={onNavigate} />)
    captured.onItemClick?.({ filterValue: 'prospect' })
    expect(onNavigate).toHaveBeenCalledWith('customers', { phase: 'prospect' })
  })
})
