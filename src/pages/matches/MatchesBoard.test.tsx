/**
 * MatchesBoard — §3 four UI states (F3 mirror of ApplicationsBoard): a
 * still-loading or failed fetch renders the centred loading/error message,
 * never five empty-looking status columns.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import MatchesBoard from './MatchesBoard'
import type { MatchRow } from '@/types/match'

const columns = [{ key: 'open', label: 'Open', color: 'var(--color-primary)' }]

describe('MatchesBoard · four UI states', () => {
  it('shows the loading message and no columns while loading', () => {
    render(<MatchesBoard rows={[]} columns={columns} onMove={vi.fn()} onSelect={vi.fn()} loading />)
    expect(screen.getByText(i18n.t('loading', { ns: 'matches' }))).toBeTruthy()
    expect(screen.queryByText('Open')).toBeNull()
  })

  it('shows the error message and no columns on a failed fetch, never zero-count columns', () => {
    render(<MatchesBoard rows={[]} columns={columns} onMove={vi.fn()} onSelect={vi.fn()} error={new Error('500')} />)
    expect(screen.getByText(i18n.t('error', { ns: 'matches' }))).toBeTruthy()
    expect(screen.queryByText('Open')).toBeNull()
  })

  it('renders the real columns once loaded without error', () => {
    const rows = [{ id: 'm-1', status: 'open', candidate: 'Jane', initials: 'JD' } as unknown as MatchRow]
    render(<MatchesBoard rows={rows} columns={columns} onMove={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByText('Open')).toBeTruthy()
  })
})
