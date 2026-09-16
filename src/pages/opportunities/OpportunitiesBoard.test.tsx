/**
 * OpportunitiesBoard — F3 four-state regression (mirrors ApplicationsBoard):
 * a loading/error fetch must never render as zero-count stage columns, and the
 * shared BoardColumnShell/BoardColumnHeader atom must be the one owning the
 * column identity (no hand-rolled fontSize/fontWeight heading).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
// Real (nl) i18n — resolves opportunities:loading/error/empty/board.empty.
import '@/i18n'
import OpportunitiesBoard from './OpportunitiesBoard'
import type { Opportunity } from '@/types/opportunity'

// DD-MM-YYYY date formatter mock (mirrors OpportunitiesTable.test.tsx).
vi.mock('@/lib/datetime', () => ({
  useLocale: () => 'nl-NL',
  useDateFormat: () => ({
    formatDate: (v: unknown) => (v == null ? '' : String(v)),
    formatDateTime: (v: unknown) => String(v),
  }),
}))

const stages = [{ value: 'lead', label: 'Lead', color: 'var(--color-primary)' }, { value: 'won', label: 'Gewonnen', color: 'var(--color-info)' }]

const row = (over: Partial<Opportunity> = {}) => ({
  id: 'o1', title: 'Detachering ICU', initials: 'DI', client: 'Zorgpartners',
  stage: 'Lead', stageValue: 'lead', stageColor: 'var(--color-primary)', value: 1000, hours: null, dealTypeUnit: null,
  owner: 'Jan de Vries', date: '2026-01-01', expectedCloseAt: null, archived: false,
  ...over,
} as unknown as Opportunity)

describe('OpportunitiesBoard · four UI states (F3)', () => {
  it('shows the loading message instead of zero-count columns while loading', () => {
    render(<OpportunitiesBoard rows={[]} stages={stages} onMove={vi.fn()} onSelect={vi.fn()} loading />)
    expect(screen.getByText('Kansen laden…')).toBeInTheDocument()
    expect(screen.queryByText('Lead')).toBeNull()
  })

  it('shows the error message instead of zero-count columns on a failed fetch', () => {
    render(<OpportunitiesBoard rows={[]} stages={stages} onMove={vi.fn()} onSelect={vi.fn()} error={new Error('boom')} />)
    expect(screen.getByText('Kansen konden niet geladen worden.')).toBeInTheDocument()
    expect(screen.queryByText('Lead')).toBeNull()
  })

  it('shows the empty message when there really are zero opportunities', () => {
    render(<OpportunitiesBoard rows={[]} stages={stages} onMove={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByText('Nog geen kansen.')).toBeInTheDocument()
  })

  it('renders the stage columns once data has actually loaded', () => {
    render(<OpportunitiesBoard rows={[row()]} stages={stages} onMove={vi.fn()} onSelect={vi.fn()} />)
    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByText('Gewonnen')).toBeInTheDocument()
    expect(screen.getByText('Detachering ICU')).toBeInTheDocument()
  })
})

describe('OpportunitiesBoard · shared column atom (HUISSTIJL-1)', () => {
  it('renders the empty-column placeholder text from the shared BoardColumnShell', () => {
    render(<OpportunitiesBoard rows={[row({ stageValue: 'lead' })]} stages={stages} onMove={vi.fn()} onSelect={vi.fn()} />)
    // 'won' column has no rows → BoardColumnShell's own dashed empty-state text.
    expect(screen.getByText('Geen kansen')).toBeInTheDocument()
  })

  it('renders the owner avatar initials and the formatted date on a card', () => {
    render(<OpportunitiesBoard rows={[row()]} stages={stages} onMove={vi.fn()} onSelect={vi.fn()} />)
    // initialsOf('Jan de Vries') → first letter of the first two words → 'JD'
    expect(screen.getByText('JD')).toBeInTheDocument()
    expect(screen.getByText('2026-01-01')).toBeInTheDocument()
  })
})
