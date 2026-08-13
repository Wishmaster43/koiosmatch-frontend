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

// SWEEP-TABLES: the source column had no render fn, so an empty source printed
// a blank cell — the only column left inconsistent with the house em-dash
// convention every other empty cell already follows.
describe('ApplicationsTable · source column em-dash (SWEEP-TABLES)', () => {
  it('renders the real source value, and a plain dash when empty — never a blank cell', () => {
    const withSource = { ...baseRow, id: 6, source: 'Website' }
    const withoutSource = { ...baseRow, id: 7, source: '' }
    const { container } = render(<ApplicationsTable rows={[withSource, withoutSource]} />)

    // Real (nl) i18n loads transitively via the component's own '@/lib/datetime'
    // import (not mocked in this file) — 'Bron' is cols.source's real translation.
    const headerCell = screen.getByText('Bron').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const rows = container.querySelectorAll('tbody tr')
    const values = Array.from(rows).map(r => r.children[colIndex].textContent)
    expect(values).toContain('Website')
    expect(values).toContain('—')
    expect(values).not.toContain('')
  })
})

// D6-KAART-2: the too_long_in_stage row flag (df9450dc) — a subtle icon next
// to the phase pill, colour never the only signal (icon shape + title text).
describe('ApplicationsTable · too-long-in-stage row icon (D6-KAART-2)', () => {
  it('shows the clock icon only on rows carrying the flag', () => {
    const flagged = { ...baseRow, id: 10, tooLongInStage: true }
    const notFlagged = { ...baseRow, id: 11, tooLongInStage: false }
    render(<ApplicationsTable rows={[flagged, notFlagged]} />)
    // Real (nl) i18n resolves kpi.tooLongInStage to the icon's accessible name.
    expect(screen.getAllByLabelText('Te lang in fase')).toHaveLength(1)
  })
})

// Danny 08-08: "Bezig 2/12 1 regel geen 2 regels" — the interview cell stacked
// the chip above the progress text, costing a second row of height in every
// table row. It must read as ONE line.
describe('ApplicationsTable · interview column', () => {
  const rowWithInterview = {
    ...baseRow, id: 9,
    interview: { category: 'busy', step: 2, total: 12 },
  } as unknown as Application

  it('renders the chip and the step progress on a single, non-wrapping line', () => {
    render(<ApplicationsTable rows={[rowWithInterview]} />)
    const progress = screen.getByText('2/12')
    const line = progress.parentElement as HTMLElement
    expect(line).toHaveStyle({ display: 'inline-flex', whiteSpace: 'nowrap' })
    // The chip is that same line's sibling — never a stacked column wrapper.
    expect(line.children.length).toBe(2)
    expect(line.style.flexDirection).not.toBe('column')
  })

  it('shows only the chip when the flow has no step count', () => {
    const noSteps = { ...rowWithInterview, id: 10, interview: { category: 'busy', step: null, total: 0 } } as unknown as Application
    render(<ApplicationsTable rows={[noSteps]} />)
    expect(screen.queryByText(/\/0$/)).toBeNull()
  })
})
