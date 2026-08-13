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
// V1: a fixed tenant ORDER — 'open' before 'concept' — the opposite of their
// alphabetical order, so a sort test can prove the tenant order wins.
vi.mock('@/context/VacancyLookupsContext', () => ({
  useVacancyLookups: () => ({
    statuses: [{ value: 'open', label: 'Open' }, { value: 'concept', label: 'Concept' }],
    statusMeta: () => ({ label: '', color: '' }),
  }),
}))
// Real getBoolSetting (pure) stays wired; only the API-backed loader is stubbed
// so the table renders without a live /settings fetch.
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => ({}) }
})
// Identity date formatter — this test doesn't cover date rendering. Keep the
// REAL relativeAge (pure, no i18n) so the new age column can be exercised.
vi.mock('@/lib/datetime', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/datetime')>()
  return {
    ...actual,
    useDateFormat: () => ({
      locale: 'nl-NL',
      formatDate: (d: unknown) => (d == null ? '—' : String(d)),
      formatDateTime: (d: unknown) => (d == null ? '—' : String(d)),
    }),
  }
})

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
    // Scoped to the Leads cell (not the whole table): the Koios column's own
    // brand mark is ALSO `role="img"` (Danny 05-08 rollout) — a page-wide query
    // would false-fail on that, unrelated mark.
    const headerCell = screen.getByText('Leads').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const leadsCell = container.querySelectorAll('tbody tr')[0].children[colIndex]
    expect(leadsCell.querySelector('[role="img"]')).not.toBeInTheDocument()
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

// JOB1: the reference number (V-12) is now a real, sortable table column —
// before this change grepping every pages/*Table.tsx for `referenceNumber`
// returned nothing at all, so a passing test here MUST fail on a revert.
// Vacancies carry no backoffice coupling (VacancyResource has no
// backoffice_links) — JOB2's compact indicator is candidates/customers/matches
// only, deliberately not added here.
describe('VacanciesTable · reference number column (JOB1)', () => {
  it('renders the real referenceNumber value, and a plain dash when absent — never a blank cell', () => {
    const withRef = { id: 'v1', title: 'Verpleegkundige', referenceNumber: 'V-00012', created: '2024-02-01', createdSort: '2024-02-01' }
    const withoutRef = { id: 'v2', title: 'Doktersassistent', referenceNumber: '', created: '2024-01-01', createdSort: '2024-01-01' }
    const { container } = render(<VacanciesTable rows={[withRef, withoutRef] as unknown as Vacancy[]} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const tableRows = container.querySelectorAll('tbody tr')
    const values = Array.from(tableRows).map(r => r.children[colIndex].textContent)
    expect(values).toContain('V-00012')
    expect(values).toContain('—')
  })

  it('sorts by reference number when the column header is clicked', async () => {
    const user = userEvent.setup()
    const mixedRows = [
      { id: 'v1', title: 'A', referenceNumber: 'V-00003', created: '2024-01-01', createdSort: '2024-01-01' },
      { id: 'v2', title: 'B', referenceNumber: 'V-00001', created: '2024-01-01', createdSort: '2024-01-01' },
      { id: 'v3', title: 'C', referenceNumber: 'V-00002', created: '2024-01-01', createdSort: '2024-01-01' },
    ] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={mixedRows} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    await user.click(within(headerCell).getByRole('button'))

    const tableRows = container.querySelectorAll('tbody tr')
    const values = Array.from(tableRows).map(r => r.children[colIndex].textContent)
    expect(values).toEqual(['V-00001', 'V-00002', 'V-00003'])
  })
})

// V4 (vacatures-tabel-cluster): the Sollicitaties count deep-links to the
// drawer's "applicants" tab — mirrors the Leads column's deep-link mechanics.
describe('VacanciesTable · Applications count deep-link (V4)', () => {
  it('renders a plain number when onOpenApplicants is not wired', () => {
    const plainRows = [{ id: 'v1', title: 'A', applicationsCount: 4, created: '2024-01-01', createdSort: '2024-01-01' }] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={plainRows} />)
    const headerCell = screen.getByText(nlVacancies.columns.applications).closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const cell = container.querySelectorAll('tbody tr')[0].children[colIndex]
    expect(cell.querySelector('button')).not.toBeInTheDocument()
    expect(cell.textContent).toBe('4')
  })

  it('clicking the applications count calls onOpenApplicants with the row id and does not open the row', async () => {
    const user = userEvent.setup()
    const onOpenApplicants = vi.fn()
    const onSelect = vi.fn()
    const appRows = [{ id: 'v7', title: 'A', applicationsCount: 6, created: '2024-01-01', createdSort: '2024-01-01' }] as unknown as Vacancy[]
    render(<VacanciesTable rows={appRows} onSelect={onSelect} onOpenApplicants={onOpenApplicants} />)

    const headerCell = screen.getByText(nlVacancies.columns.applications).closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const btn = within(screen.getAllByRole('row')[1].children[colIndex] as HTMLElement).getByRole('button')
    expect(btn).toHaveTextContent('6')
    await user.click(btn)

    expect(onOpenApplicants).toHaveBeenCalledWith('v7')
    expect(onSelect).not.toHaveBeenCalled()
  })
})

// V-table-2: the Matches count deep-links to the drawer's read-only Matches tab —
// mirrors the Applications column's deep-link mechanics verbatim.
describe('VacanciesTable · Matches count deep-link (V-table-2)', () => {
  it('renders a plain number when onOpenMatches is not wired', () => {
    const plainRows = [{ id: 'v1', title: 'A', matchesCount: 2, created: '2024-01-01', createdSort: '2024-01-01' }] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={plainRows} />)
    const headerCell = screen.getByText(nlVacancies.columns.matches).closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const cell = container.querySelectorAll('tbody tr')[0].children[colIndex]
    expect(cell.querySelector('button')).not.toBeInTheDocument()
    expect(cell.textContent).toBe('2')
  })

  it('clicking the matches count calls onOpenMatches with the row id and does not open the row', async () => {
    const user = userEvent.setup()
    const onOpenMatches = vi.fn()
    const onSelect = vi.fn()
    const matchRows = [{ id: 'v8', title: 'A', matchesCount: 3, created: '2024-01-01', createdSort: '2024-01-01' }] as unknown as Vacancy[]
    render(<VacanciesTable rows={matchRows} onSelect={onSelect} onOpenMatches={onOpenMatches} />)

    const headerCell = screen.getByText(nlVacancies.columns.matches).closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const btn = within(screen.getAllByRole('row')[1].children[colIndex] as HTMLElement).getByRole('button')
    expect(btn).toHaveTextContent('3')
    await user.click(btn)

    expect(onOpenMatches).toHaveBeenCalledWith('v8')
    expect(onSelect).not.toHaveBeenCalled()
  })
})

// V2 (vacatures-tabel-cluster): a compact relative-age column derived from
// created_at — no backend dependency, so this is exercisable with pure dates.
describe('VacanciesTable · Age column (V2)', () => {
  it('renders an em-dash for a missing created date', () => {
    const rowsNoDate = [{ id: 'v1', title: 'A', created: '', createdSort: '' }] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={rowsNoDate} />)
    // falls back to the raw key string; this proves the COLUMN exists and works,
    // independent of the eventual translated label.
    const headerCell = screen.getByText('Leeftijd').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[colIndex].textContent).toBe('—')
  })

  it('carries the exact formatted date as a tooltip for a known created date', () => {
    const rowsWithDate = [{ id: 'v1', title: 'A', created: '2024-01-01', createdSort: '2024-01-01' }] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={rowsWithDate} />)
    const headerCell = screen.getByText('Leeftijd').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const cell = container.querySelectorAll('tbody tr')[0].children[colIndex]
    expect(cell.querySelector('span')?.getAttribute('title')).toBe('2024-01-01')
  })
})

// V1 (vacatures-tabel-cluster): status column sort follows the tenant's
// configured lookup ORDER (array index), not the alphabetical label — with
// published-first as the secondary key within the same status.
describe('VacanciesTable · Status sort follows tenant order (V1)', () => {
  it('sorts by the tenant lookup order (open before concept), not alphabetically by label', async () => {
    // Alphabetically "Concept" < "Open", but the mocked tenant order above puts Open FIRST.
    const user = userEvent.setup()
    const mixedRows = [
      { id: 'v1', title: 'A', statusValue: 'concept', statusLabel: 'Concept', published: true, created: '2024-01-01', createdSort: '2024-01-01' },
      { id: 'v2', title: 'B', statusValue: 'open', statusLabel: 'Open', published: true, created: '2024-01-01', createdSort: '2024-01-01' },
    ] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={mixedRows} />)

    const headerCell = screen.getByText(nlVacancies.columns.status).closest('th') as HTMLElement
    await user.click(within(headerCell).getByRole('button'))

    const titles = Array.from(container.querySelectorAll('tbody tr')).map(tr => tr.children[0].textContent)
    expect(titles).toEqual(['B', 'A'])
  })

  it('uses published as a secondary key within the same status (published first)', async () => {
    const user = userEvent.setup()
    const mixedRows = [
      { id: 'v1', title: 'A', statusValue: 'open', statusLabel: 'Open', published: false, created: '2024-01-01', createdSort: '2024-01-01' },
      { id: 'v2', title: 'B', statusValue: 'open', statusLabel: 'Open', published: true, created: '2024-01-01', createdSort: '2024-01-01' },
    ] as unknown as Vacancy[]
    const { container } = render(<VacanciesTable rows={mixedRows} />)

    const headerCell = screen.getByText(nlVacancies.columns.status).closest('th') as HTMLElement
    await user.click(within(headerCell).getByRole('button'))

    const titles = Array.from(container.querySelectorAll('tbody tr')).map(tr => tr.children[0].textContent)
    expect(titles).toEqual(['B', 'A'])
  })
})

// SWEEP-TABLES: VacancyQuery::rules() only validates `sort=status` server-side
// (verified live against VacancyQuery.php) — serverKey is wired on that ONE
// column, and sort/onSortChange are optional, additive props (DATATABLE-SORT-1)
// so an uncontrolled caller (every other test in this file) stays untouched.
describe('VacanciesTable · controlled sort — status serverKey (SWEEP-TABLES)', () => {
  it('clicking the Status header hands the caller {by: "status", dir: "asc"} — the only server-supported sort key', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<VacanciesTable rows={rows} sort={null} onSortChange={onSortChange} />)

    const headerCell = screen.getByText(nlVacancies.columns.status).closest('th') as HTMLElement
    await user.click(within(headerCell).getByRole('button'))

    expect(onSortChange).toHaveBeenCalledWith({ by: 'status', dir: 'asc' })
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

// Danny 05-08: the "Koios" column now rolls out to every entity table — this is
// the smoke test proving the header renders here too (the honest per-row rule
// lives in vacancyAdvice.test.ts).
describe('VacanciesTable · Koios column (Danny 05-08)', () => {
  it('renders the header with the Koios mark, and flags a published vacancy with zero applications past the stale threshold', () => {
    const stale = {
      id: 'v1', title: 'Verpleegkundige', published: true, archived: false, applicationsCount: 0,
      created: '2000-01-01', createdSort: '2000-01-01',
    } as unknown as Vacancy
    const fresh = {
      id: 'v2', title: 'Doktersassistent', published: true, archived: false, applicationsCount: 0,
      created: new Date().toISOString(), createdSort: new Date().toISOString(),
    } as unknown as Vacancy
    render(<VacanciesTable rows={[stale, fresh]} />)

    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Aandacht')).toBeInTheDocument()
  })

  it('renders an honest dash for an unpublished vacancy, even with zero applications', () => {
    const draft = { id: 'v3', title: 'Concept', published: false, archived: false, applicationsCount: 0, created: '2000-01-01', createdSort: '2000-01-01' } as unknown as Vacancy
    const { container } = render(<VacanciesTable rows={[draft]} />)
    const headerCell = screen.getByRole('img', { name: 'Koios AI' }).closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[col].textContent).toBe('—')
  })
})
