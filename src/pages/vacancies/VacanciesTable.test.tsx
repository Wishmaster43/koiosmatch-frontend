import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so the "AI-agent" column header resolves genuine
// Dutch text (mirrors VacancyDrawer.test.tsx's convention).
import '@/i18n'
import VacanciesTable from './VacanciesTable'
import type { Vacancy } from '@/types/vacancy'
import nlVacancies from '@/i18n/locales/nl/vacancies.json'

// Lookups arrive via a mocked hook — statusMeta only matters for rows without a
// resolved statusLabel, which these fixtures don't exercise.
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({ statusMeta: () => ({ label: '', color: '' }) }),
}))
// Real getBoolSetting (pure) stays wired; only the API-backed loader is stubbed
// so the table renders without a live /settings fetch.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => ({}) }
})
// Identity date formatter — this test doesn't cover date rendering.
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({
    locale: 'nl-NL',
    formatDate: (d: unknown) => (d == null ? '—' : String(d)),
    formatDateTime: (d: unknown) => (d == null ? '—' : String(d)),
  }),
}))

// Minimal rows — only the fields the table's columns actually read; cast past the
// full Vacancy shape (mirrors DetailsTab.test.tsx's VacancyDetail cast). Explicit
// distinct createdSort values so the table's real newest-first defaultSort (the
// VAC-KPI-REDESIGN 22-07 meelift-fix) doesn't reorder rows out from under this test.
const rows = [
  { id: 'v1', title: 'Verpleegkundige', aiAgentName: 'Kelly', created: '2024-02-01', createdSort: '2024-02-01' },
  { id: 'v2', title: 'Doktersassistent', aiAgentName: '', created: '2024-01-01', createdSort: '2024-01-01' },
] as unknown as Vacancy[]

describe('VacanciesTable · AI-agent column (Danny 22-07)', () => {
  it('renders the Sparkle avatar + name when an agent is linked, and a plain em-dash when none is', () => {
    const { container } = render(<VacanciesTable rows={rows} />)

    // Locate the AI-agent column by its real (nl) header text, not a hardcoded index.
    const headerCell = screen.getByText('AI-agent').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const tableRows = container.querySelectorAll('tbody tr')
    expect(tableRows).toHaveLength(2)

    const agentCellRow1 = tableRows[0].children[colIndex]
    expect(agentCellRow1.textContent).toContain('Kelly')
    expect(agentCellRow1.querySelector('svg')).toBeTruthy()

    const agentCellRow2 = tableRows[1].children[colIndex]
    expect(agentCellRow2.textContent).toBe('—')
    expect(agentCellRow2.querySelector('svg')).toBeFalsy()
  })
})

describe('VacanciesTable · Leads count deep-link (VACANCY-MATCH-COUNT-1, Danny 23-07)', () => {
  it('renders a plain number when onOpenCandidateSearch is not wired', () => {
    render(<VacanciesTable rows={rows} />)
    expect(screen.queryByRole('button', { name: 'Open Kandidaten zoeken' })).not.toBeInTheDocument()
  })

  it('clicking the leads count calls onOpenCandidateSearch with the row id and does not open the row', async () => {
    const user = userEvent.setup()
    const onOpenCandidateSearch = vi.fn()
    const onSelect = vi.fn()
    const leadsRows = [
      { id: 'v1', title: 'Verpleegkundige', leadsCount: 3, created: '2024-02-01', createdSort: '2024-02-01' },
    ] as unknown as Vacancy[]
    render(<VacanciesTable rows={leadsRows} onSelect={onSelect} onOpenCandidateSearch={onOpenCandidateSearch} />)

    // The button's real (nl) aria-label + its own text (the leads count).
    const btn = screen.getByRole('button', { name: 'Open Kandidaten zoeken' })
    expect(btn).toHaveTextContent('3')
    await user.click(btn)

    expect(onOpenCandidateSearch).toHaveBeenCalledWith('v1')
    // stopPropagation on the button's click must stop the row's own onClick firing.
    expect(onSelect).not.toHaveBeenCalled()
  })

  // VACANCY-LEADS-COUNT-1 (Danny 25-07): a null leadsCount must render as an
  // honest em dash, never a fake 0 — while the click-through button still fires.
  it('renders a muted em dash for a null leadsCount and still fires the click-through', async () => {
    const user = userEvent.setup()
    const onOpenCandidateSearch = vi.fn()
    const unknownRows = [
      { id: 'v9', title: 'Onbekend', leadsCount: null, created: '2024-02-01', createdSort: '2024-02-01' },
    ] as unknown as Vacancy[]
    render(<VacanciesTable rows={unknownRows} onOpenCandidateSearch={onOpenCandidateSearch} />)

    const btn = screen.getByRole('button', { name: 'Open Kandidaten zoeken' })
    expect(btn).toHaveTextContent('—')
    await user.click(btn)
    expect(onOpenCandidateSearch).toHaveBeenCalledWith('v9')
  })

  it('renders a muted em dash even without the click-through wired', () => {
    const unknownRows = [
      { id: 'v9', title: 'Onbekend', leadsCount: null, created: '2024-02-01', createdSort: '2024-02-01' },
    ] as unknown as Vacancy[]
    render(<VacanciesTable rows={unknownRows} />)
    // Located via the explanatory title (unique text) rather than the dash glyph
    // itself, which several other empty cells in the row also render.
    expect(screen.getByTitle(nlVacancies.columns.leadsUnknown)).toBeInTheDocument()
  })
})

describe('VacanciesTable · Leads sort puts unknown rows last (VACANCY-LEADS-COUNT-1)', () => {
  it('sorts a null leadsCount after every known count on first click (ascending)', async () => {
    const user = userEvent.setup()
    const mixedRows = [
      { id: 'v1', title: 'A', leadsCount: null, created: '2024-01-01', createdSort: '2024-01-01' },
      { id: 'v2', title: 'B', leadsCount: 3, created: '2024-01-01', createdSort: '2024-01-01' },
      { id: 'v3', title: 'C', leadsCount: 1, created: '2024-01-01', createdSort: '2024-01-01' },
    ] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={mixedRows} />)

    const headerCell = screen.getByText('Leads').closest('th') as HTMLElement
    // Click the header BUTTON: sorting lives in a real button since the keyboard-
    // accessibility fix (audit 2026-07-27); clicking the th alone proves nothing.
    await user.click(within(headerCell).getByRole('button'))

    const titles = Array.from(container.querySelectorAll('tbody tr')).map(tr => tr.children[0].textContent)
    expect(titles).toEqual(['C', 'B', 'A'])
  })
})

describe('VacanciesTable · match count state caveats (VACANCY-LEADS-COUNT-1)', () => {
  it('renders a stale-caveat dot with an aria-label alongside a known count', () => {
    const staleRows = [
      { id: 'v1', title: 'Verpleegkundige', leadsCount: 5, created: '2024-02-01', createdSort: '2024-02-01',
        matchCountState: { computedAt: '2026-07-20', isStale: true, geoMissing: false, partial: false } },
    ] as unknown as Vacancy[]
    render(<VacanciesTable rows={staleRows} />)
    // The caveat must be visible without hovering — an aria-label-carrying dot, not tooltip-only.
    expect(screen.getByLabelText(nlVacancies.columns.leadsStale.replace('{{date}}', '2026-07-20'))).toBeInTheDocument()
  })

  it('renders the plain number with no caveat dot when the count carries no state', () => {
    const plainRows = [
      { id: 'v1', title: 'Verpleegkundige', leadsCount: 5, created: '2024-02-01', createdSort: '2024-02-01', matchCountState: null },
    ] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={plainRows} />)
    expect(container.querySelector('[role="img"]')).not.toBeInTheDocument()
  })

  it('shows the geo-missing caveat when coordinates were unavailable', () => {
    const geoRows = [
      { id: 'v1', title: 'Verpleegkundige', leadsCount: 2, created: '2024-02-01', createdSort: '2024-02-01',
        matchCountState: { computedAt: '2026-07-20', isStale: false, geoMissing: true, partial: false } },
    ] as unknown as Vacancy[]
    render(<VacanciesTable rows={geoRows} />)
    expect(screen.getByLabelText(nlVacancies.columns.leadsGeoMissing)).toBeInTheDocument()
  })

  it('shows the partial caveat when a limit was hit', () => {
    const partialRows = [
      { id: 'v1', title: 'Verpleegkundige', leadsCount: 50, created: '2024-02-01', createdSort: '2024-02-01',
        matchCountState: { computedAt: '2026-07-20', isStale: false, geoMissing: false, partial: true } },
    ] as unknown as Vacancy[]
    render(<VacanciesTable rows={partialRows} />)
    expect(screen.getByLabelText(nlVacancies.columns.leadsPartial)).toBeInTheDocument()
  })
})

describe('VacanciesTable · default sort (VAC-KPI-REDESIGN 22-07 meelift-fix)', () => {
  it('sorts newest-first by createdAt on first render — defaultSort must match the real column key', () => {
    // The column's real key is 'createdAt' (not 'created'); a stale defaultSort key
    // used to silently no-op (DataTable drops an unresolvable sort key), leaving
    // rows in their raw insertion order instead of newest-first.
    const unsortedRows = [
      { id: 'v1', title: 'Oud', created: '2020-01-01', createdSort: '2020-01-01' },
      { id: 'v2', title: 'Nieuw', created: '2024-01-01', createdSort: '2024-01-01' },
    ] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={unsortedRows} />)
    const titleCells = Array.from(container.querySelectorAll('tbody tr')).map(tr => tr.children[0].textContent)
    expect(titleCells).toEqual(['Nieuw', 'Oud'])
  })
})
