/**
 * ShiftsDrillDownDrawer — DATUM-1 regression: the details list renders shift
 * dates/times through the house useDateFormat() formatters (DD-MM-YYYY), never
 * a locally re-implemented toLocaleDateString/toLocaleTimeString call.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShiftsDrillDownDrawer from './ShiftsDrillDownDrawer'
import i18n from '@/i18n'

// Stub the data hook so the drawer renders one deterministic shift row without a network call.
vi.mock('./hooks/useDrillDownShifts', () => ({
  useDrillDownShifts: () => ({
    shifts: [{
      id: 1,
      job_type: 'Warehouse',
      own_status: 'open',
      start_time: '2026-03-05T08:00:00Z',
      end_time: '2026-03-05T16:00:00Z',
      number_persons: 1,
      invites: [],
    }],
    loading: false,
    error: false,
  }),
}))

describe('ShiftsDrillDownDrawer', () => {
  it('renders the shift date as DD-MM-YYYY via the house formatter, not a locale-word date', () => {
    render(
      <ShiftsDrillDownDrawer
        metric="totaal"
        metricOptions={[{ value: 'totaal', label: 'Totaal' }]}
        periods={[{ key: '2026-03', label: 'maart' }]}
        initialPeriod="2026-03"
        buildUrl={() => '/sm_shifts'}
        titleFor={() => 'Shifts'}
        countFor={() => 1}
        onClose={vi.fn()}
      />
    )
    // Switch from the default totals view into the details list.
    fireEvent.click(screen.getByText(i18n.t('shiftsDrawer.viewDetails', { ns: 'shiftmanager' })))
    // DD-MM-YYYY digits (DATUM-1) — never the old "5 mrt 2026" word-month shape.
    expect(screen.getByText(/05-03-2026/)).toBeInTheDocument()
  })
})
