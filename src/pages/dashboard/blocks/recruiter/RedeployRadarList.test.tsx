/**
 * RedeployRadarList — renders soon-to-end matches and navigates to the match drawer.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RedeployRadarList from './RedeployRadarList'
import type { RedeployRadarRow } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { count?: number }) => opts?.count != null ? `${opts.count} days` : k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: () => '30-08-2026' }) }))

const row: RedeployRadarRow = {
  candidate_id: 'c1', candidate: { id: 'c1', name: 'Sara' }, match_id: 'm1',
  customer: { id: 'cust1', name: 'Acme' }, end_date: '2026-08-30', days_left: 5,
}

describe('RedeployRadarList', () => {
  it('self-hides on an empty feed', () => {
    const { container } = render(<RedeployRadarList rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the row and navigates to the match on click', () => {
    const onNavigate = vi.fn()
    render(<RedeployRadarList rows={[row]} onNavigate={onNavigate} />)
    expect(screen.getByText('Sara')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    // The composed meta: formatted end date + the days-left translation.
    expect(screen.getByText('30-08-2026 · 5 days')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Sara'))
    expect(onNavigate).toHaveBeenCalledWith('matches', { open: 'm1' })
  })
})
