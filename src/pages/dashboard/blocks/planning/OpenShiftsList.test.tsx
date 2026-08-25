/**
 * OpenShiftsList — renders open-shift rows and routes every click to planning.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OpenShiftsList from './OpenShiftsList'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v }) }))

const rows = [
  { shift_id: 's1', start_time: '2026-08-24T08:00:00Z', end_time: '2026-08-24T16:00:00Z', order_title: 'Warehouse shift', status: 'open' as const },
]

describe('OpenShiftsList', () => {
  it('renders rows from the server shape and navigates to planning on click', () => {
    const onNavigate = vi.fn()
    render(<OpenShiftsList rows={rows} onNavigate={onNavigate} />)
    expect(screen.getByText('Warehouse shift')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Warehouse shift'))
    expect(onNavigate).toHaveBeenCalledWith('planning')
  })

  it('falls back to the unknown label when order_title is missing', () => {
    render(<OpenShiftsList rows={[{ ...rows[0], order_title: null }]} />)
    expect(screen.getByText('widget.unknown')).toBeInTheDocument()
  })
})
