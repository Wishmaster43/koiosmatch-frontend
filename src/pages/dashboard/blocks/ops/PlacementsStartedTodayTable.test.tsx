/**
 * PlacementsStartedTodayTable — asserts rows render from the exact server
 * shape with an ok/not-ok checklist (icon + sr-only text, colour not the only
 * signal), and a row click opens the match.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlacementsStartedTodayTable from './PlacementsStartedTodayTable'
import type { PlacementStartedTodayRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const rows: PlacementStartedTodayRow[] = [
  { match_id: 'm1', candidate: 'Jan Jansen', customer: 'Acme', contract_ok: true, document_ok: false, koppeling_ok: true },
]

describe('PlacementsStartedTodayTable', () => {
  it('renders rows from the server shape with sr-only ok/not-ok text per checklist cell', () => {
    render(<PlacementsStartedTodayTable rows={rows} onNavigate={vi.fn()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getAllByText('feed.ok')).toHaveLength(2)
    expect(screen.getAllByText('feed.notOk')).toHaveLength(1)
  })

  it('navigates to the match drawer on row click', () => {
    const onNavigate = vi.fn()
    render(<PlacementsStartedTodayTable rows={rows} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Jan Jansen'))
    expect(onNavigate).toHaveBeenCalledWith('matches', { open: 'm1' })
  })

  it('self-hides on an empty feed', () => {
    const { container } = render(<PlacementsStartedTodayTable rows={[]} onNavigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
