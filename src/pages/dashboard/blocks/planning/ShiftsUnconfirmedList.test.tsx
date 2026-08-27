/**
 * ShiftsUnconfirmedList — renders rows from the server shape and navigates to
 * the candidate's communication tab on click.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShiftsUnconfirmedList from './ShiftsUnconfirmedList'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v }) }))

const rows = [
  { schedule_id: 'sc1', candidate_id: 'c1', candidate: 'Jane Doe', shift_start: '2026-08-24T08:00:00Z', order_title: 'Warehouse shift' },
]

describe('ShiftsUnconfirmedList', () => {
  it('renders rows and navigates to the candidate communication tab', () => {
    const onNavigate = vi.fn()
    render(<ShiftsUnconfirmedList rows={rows} onNavigate={onNavigate} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Jane Doe'))
    expect(onNavigate).toHaveBeenCalledWith('candidates', { open: 'c1', tab: 'communication' })
  })

  it('falls back to unknown and a dash when candidate/start are missing', () => {
    render(<ShiftsUnconfirmedList rows={[{ ...rows[0], candidate: null, shift_start: null }]} />)
    expect(screen.getByText('widget.unknown')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
