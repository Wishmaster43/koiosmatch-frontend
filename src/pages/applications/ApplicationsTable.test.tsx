/**
 * ApplicationsTable — the "Koios" column (Danny 05-08 consistency pass). Was a
 * hand-rolled mark+text cell with no dash/sort support; now the shared
 * makeKoiosColumn factory wraps the SAME `task` field the row already carries.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationsTable from './ApplicationsTable'
import type { Application } from '@/types/application'

// The status column's CandidateStatusChip resolves its own tenant lookup via
// this context (mirrors ApplicationTab.test.tsx's identical stub).
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    statusMeta: (v?: string) => ({ label: v ?? '', color: 'var(--text-muted)' }),
    phases: [{ value: 'lead' }],
  }),
}))
// Stub the API-backed settings loader so the table renders without a live
// /settings fetch (mirrors every other entity table's test convention).
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))

const baseRow = {
  id: 1, candidateName: 'Jane Doe', candidateInitials: 'JD', vacancyTitle: 'Verpleegkundige',
  client: 'Zorgpartners', score: 80, phaseLabel: 'Gesolliciteerd', phaseColor: '#000',
  candidateStatusLabel: 'Beschikbaar', created: '2026-01-01', source: 'Website', task: '',
  owner: { name: 'Owner', initials: '?' },
} as unknown as Application

describe('ApplicationsTable · Koios column', () => {
  it('renders the header with the Koios mark + label', () => {
    render(<ApplicationsTable rows={[baseRow]} />)
    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Koios')).toBeInTheDocument()
  })

  it('shows the backend AI task text as the advice, and an honest dash without one', () => {
    const withTask = { ...baseRow, id: 2, task: 'Bel de kandidaat terug' }
    const withoutTask = { ...baseRow, id: 3, task: '' }
    render(<ApplicationsTable rows={[withTask, withoutTask]} />)
    expect(screen.getByText('Bel de kandidaat terug')).toBeInTheDocument()

    const headerCell = screen.getByText('Koios').closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = document.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[col].textContent)
    expect(values).toContain('—')
  })

  it('sorts on the advice action — a real action sorts before the dash rows (DataTable\'s compare() sinks empty sort values, mirrors every other column)', async () => {
    const user = userEvent.setup()
    const withTask = { ...baseRow, id: 4, task: 'Volg op' }
    const withoutTask = { ...baseRow, id: 5, task: '' }
    render(<ApplicationsTable rows={[withoutTask, withTask]} />)

    const headerCell = screen.getByText('Koios').closest('th') as HTMLElement
    await user.click(within(headerCell).getByRole('button'))

    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = document.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[col].textContent)
    expect(values).toEqual(['Volg op', '—'])
  })
})
