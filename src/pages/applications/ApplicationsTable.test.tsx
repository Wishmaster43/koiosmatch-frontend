/**
 * ApplicationsTable — the "Koios" column (Danny 05-08 consistency pass). Was a
 * hand-rolled mark+text cell with no dash/sort support; now the shared
 * makeKoiosColumn factory wraps the SAME `task` field the row already carries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
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
// /settings fetch (mirrors every other entity table's test convention). The
// overrides map lets one test flip a flag (e.g. the koios colour toggle)
// without touching the fallback behaviour every other test relies on.
const boolSettingOverrides = vi.hoisted(() => ({} as Record<string, boolean>))
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, key: string, fallback: boolean) => boolSettingOverrides[key] ?? fallback,
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

// KOIOS-ADVIES-OVERAL-1 regression: the free-text task advice used to bypass
// ADVICE_META (inline adviceOfTask, no source tag, default sparkle icon). It now
// flows through useApplicationAdvice → the shared KoiosAdvicePill, so with the
// colour toggle on it renders the soft chip with ADVICE_META's task icon.
describe('ApplicationsTable · task advice through the shared pill (KOIOS-ADVIES-OVERAL-1)', () => {
  it('renders the coloured pill with the clipboard task icon, never a raw-text bypass', () => {
    boolSettingOverrides['application_table_color_koios'] = true
    try {
      const withTask = { ...baseRow, id: 30, task: 'Bel de kandidaat terug' }
      render(<ApplicationsTable rows={[withTask]} />)
      const label = screen.getByText('Bel de kandidaat terug')
      // The pill wrapper (SoftChip) carries the icon SVG next to the label —
      // ADVICE_META's dedicated `task` entry, not the default sparkle fallback.
      const chip = label.closest('span[style]') as HTMLElement
      expect(chip.querySelector('svg.lucide-clipboard-list')).toBeInTheDocument()
      expect(chip.querySelector('svg.lucide-sparkles')).toBeNull()
    } finally {
      delete boolSettingOverrides['application_table_color_koios']
    }
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

// PLACED-1 (2026-08-14): the placed row badge — colour is never the only signal,
// so the icon renders behind an accessible name (real nl i18n resolves it).
describe('ApplicationsTable · placed row badge (PLACED-1)', () => {
  it('shows the placed badge only on rows carrying hasMatch', () => {
    const placed = { ...baseRow, id: 20, hasMatch: true }
    const notPlaced = { ...baseRow, id: 21, hasMatch: false }
    render(<ApplicationsTable rows={[placed, notPlaced]} />)
    expect(screen.getAllByLabelText('Geplaatst')).toHaveLength(1)
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

  // PDF-SOLLICITATIES point 7 (14-08): clicking the interview cell jumps the
  // drawer straight to the Interview tab, not just the row's default tab.
  it('clicking the interview cell calls onSelect with the interviews tab, not a plain row open', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ApplicationsTable rows={[rowWithInterview]} onSelect={onSelect} />)
    await user.click(screen.getByText('2/12').parentElement as HTMLElement)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(rowWithInterview, 'interviews')
  })
})

// PDF-SOLLICITATIES point 8 (14-08): plain day count in the CURRENT phase —
// sourced from the REAL currentStageEnteredAt field (ApplicationListResource's
// application_stage_transitions-backed timestamp), never derived from `created`
// (that would be application age, a different number).
describe('ApplicationsTable · days-in-phase column (PDF-SOLLICITATIES point 8)', () => {
  beforeEach(() => {
    // Fixed "now" so the day-count math is deterministic.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('renders the real day count from currentStageEnteredAt, not from created_at', () => {
    const row = {
      ...baseRow, id: 40,
      created: '2026-01-01T00:00:00Z', // application age — a different number
      currentStageEnteredAt: '2026-08-10T12:00:00Z', // 4 days in the current phase
    } as unknown as Application
    render(<ApplicationsTable rows={[row]} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    // Never the age-in-days derived from created_at (would be ~225).
    expect(screen.queryByText('225')).toBeNull()
  })

  it('renders a dash, never a fabricated zero, when currentStageEnteredAt is missing', () => {
    const row = { ...baseRow, id: 41, currentStageEnteredAt: null } as unknown as Application
    render(<ApplicationsTable rows={[row]} />)
    const headerCell = screen.getByText('Dagen in fase').closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const cell = document.querySelectorAll('tbody tr')[0].children[col]
    expect(cell.textContent).toBe('—')
    expect(cell.textContent).not.toBe('0')
  })

  it('colours the count with the warning tint when tooLongInStage is flagged (server threshold)', () => {
    const flagged = { ...baseRow, id: 42, currentStageEnteredAt: '2026-08-01T00:00:00Z', tooLongInStage: true } as unknown as Application
    render(<ApplicationsTable rows={[flagged]} />)
    const count = screen.getByText('13')
    expect(count).toHaveStyle({ color: 'var(--color-warning)' })
  })

  it('sorts by days in the current phase (who is stuck longest)', () => {
    const short = { ...baseRow, id: 43, currentStageEnteredAt: '2026-08-13T00:00:00Z' } as unknown as Application // 1 day
    const long = { ...baseRow, id: 44, currentStageEnteredAt: '2026-08-01T00:00:00Z' } as unknown as Application // 13 days
    render(<ApplicationsTable rows={[short, long]} />)

    const headerCell = screen.getByText('Dagen in fase').closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    fireEvent.click(within(headerCell).getByRole('button'))
    let rows = document.querySelectorAll('tbody tr')
    let values = Array.from(rows).map(r => r.children[col].textContent)
    expect(values).toEqual(['1', '13'])

    fireEvent.click(within(headerCell).getByRole('button'))
    rows = document.querySelectorAll('tbody tr')
    values = Array.from(rows).map(r => r.children[col].textContent)
    expect(values).toEqual(['13', '1'])
  })
})

// PDF-SOLLICITATIES point 6 (14-08): clicking the vacancy in a row jumps the
// drawer straight to the Vacature tab of that application.
describe('ApplicationsTable · vacancy cell navigation (point 6)', () => {
  it('clicking the vacancy cell calls onSelect with the vacancy tab, not a plain row open', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ApplicationsTable rows={[baseRow]} onSelect={onSelect} />)
    await user.click(screen.getByText('Verpleegkundige'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(baseRow, 'vacancy')
  })

  it('a plain row click (outside the vacancy/interview cells) opens on the default tab', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ApplicationsTable rows={[baseRow]} onSelect={onSelect} />)
    await user.click(screen.getByText('Jane Doe'))
    expect(onSelect).toHaveBeenCalledWith(baseRow)
  })
})
