/**
 * CouplingErrorsList — asserts rows render from the exact server shape, a
 * known entity_type deep-links to its own page, and an unknown entity_type
 * renders inert (no click, no keyboard role).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CouplingErrorsList from './CouplingErrorsList'
import type { CouplingErrorRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDateTime: (v: string) => `fmt:${v}` }) }))

const rows: CouplingErrorRow[] = [
  { entity_type: 'candidate', entity_id: 'c1', entity_label: 'Jan Jansen', system: 'shiftmanager', error: 'GUID mismatch', synced_at: '2026-08-20T10:00:00Z' },
  { entity_type: 'unknown_thing', entity_id: 'x1', entity_label: 'Ghost', system: 'helloflex', error: null, synced_at: null },
]

describe('CouplingErrorsList', () => {
  it('renders rows from the server shape with system + error and a synced timestamp', () => {
    render(<CouplingErrorsList rows={rows} onNavigate={vi.fn()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('feed.system.shiftmanager: GUID mismatch')).toBeInTheDocument()
    expect(screen.getByText('fmt:2026-08-20T10:00:00Z')).toBeInTheDocument()
  })

  it('navigates to the candidate on row click for a known entity_type', () => {
    const onNavigate = vi.fn()
    render(<CouplingErrorsList rows={rows} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Jan Jansen'))
    expect(onNavigate).toHaveBeenCalledWith('candidates', { open: 'c1' })
  })

  it('renders an unknown entity_type inert (no button role, click does not navigate)', () => {
    const onNavigate = vi.fn()
    render(<CouplingErrorsList rows={rows} onNavigate={onNavigate} />)
    expect(screen.getByText('Ghost').closest('[role="button"]')).toBeNull()
    fireEvent.click(screen.getByText('Ghost'))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('self-hides on an empty feed', () => {
    const { container } = render(<CouplingErrorsList rows={[]} onNavigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
