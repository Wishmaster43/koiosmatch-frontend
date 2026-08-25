/**
 * OpenShiftsList — renders open-shift rows and routes every row click to the
 * exact shift's staffing drawer on its own day (PLANNING-INTENT-1).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OpenShiftsList from './OpenShiftsList'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// toLocalIsoDate mirrors the real house helper: local-calendar-day formatting
// of a Date, so the UTC-vs-local-day mock case below is genuinely exercised.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => v }),
  toLocalIsoDate: (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },
}))

const rows = [
  { shift_id: 's1', start_time: '2026-08-24T08:00:00Z', end_time: '2026-08-24T16:00:00Z', order_title: 'Warehouse shift', status: 'open' as const },
]

describe('OpenShiftsList', () => {
  it('renders rows from the server shape and navigates to the exact shift/day on click', () => {
    const onNavigate = vi.fn()
    render(<OpenShiftsList rows={rows} onNavigate={onNavigate} />)
    expect(screen.getByText('Warehouse shift')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Warehouse shift'))
    expect(onNavigate).toHaveBeenCalledWith('planning', { open: 's1', date: '2026-08-24' })
  })

  it('derives the LOCAL calendar day, not the raw UTC day, for a night shift crossing midnight UTC', () => {
    // A shift starting 00:30 UTC lands on the PREVIOUS local day in any
    // timezone ahead of UTC — the row must still navigate to that local day
    // (matches the day the row's own formatDate already displays).
    const nightRow = { shift_id: 's2', start_time: '2026-08-25T00:30:00Z', end_time: null, order_title: 'Night shift', status: 'open' as const }
    const onNavigate = vi.fn()
    render(<OpenShiftsList rows={[nightRow]} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Night shift'))
    const expectedDate = (() => {
      const d = new Date('2026-08-25T00:30:00Z')
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    })()
    expect(onNavigate).toHaveBeenCalledWith('planning', { open: 's2', date: expectedDate })
  })

  it('falls back to the unknown label when order_title is missing', () => {
    render(<OpenShiftsList rows={[{ ...rows[0], order_title: null }]} />)
    expect(screen.getByText('widget.unknown')).toBeInTheDocument()
  })
})
