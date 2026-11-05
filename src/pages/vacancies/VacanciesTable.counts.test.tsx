/** VacanciesTable · deep-linked count and age columns (split from VacanciesTable.test.tsx; each file carries the mocks its own tests need). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so the "AI-agent" column header resolves genuine
// Dutch text (mirrors VacancyDrawer.test.tsx's convention). Default-exported so the
// seeded-label tests in the sibling file switch languages (mirrors Sidebar.test.jsx).
import '@/i18n'
import VacanciesTable from './VacanciesTable'

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity }) }))
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

// Mock useLookups and useSeedLabel for the table's own label resolution (the floating leads panel that first needed them is gone — TABEL-PIJL-WEG 17-09).
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    phaseMeta: (v?: string) => ({ label: v === 'candidate' ? 'Candidate' : 'Lead', color: '#000' }),
  }),
}))
vi.mock('@/lib/useSeedLabel', async (importOriginal) => {
  // Keep the REAL useSeedLabel for vacancyStatuses (the existing i18n test needs it),
  // but stub candidateSources for the source label.
  const actual = await importOriginal<typeof import('@/lib/useSeedLabel')>()
  return {
    useSeedLabel: () => (namespace: string, options: { label?: string; value?: string }) => {
      if (namespace === 'candidateSources') {
        return options.label === 'website' ? 'Website' : options.label
      }
      // Delegate to the real useSeedLabel for all other namespaces.
      return actual.useSeedLabel()(namespace, options as Parameters<ReturnType<typeof actual.useSeedLabel>>[1])
    },
  }
})

// Mock useDateFormat for the table's date cells. Keep the REAL
// daysSince (pure, no i18n) so the age column can be exercised.
vi.mock('@/lib/datetime', async (importOriginal) => {
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

  // PDF-VACATURES-2026-08-14 point 4 (Danny 14-08): a plain day count, no unit
  // letter ("3", never "3d") — deterministic via vitest's fake system clock.
  it('renders a plain day count with no unit letter', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T00:00:00Z'))
    try {
      const rows = [{ id: 'v1', title: 'A', created: '2024-01-12T00:00:00Z', createdSort: '2024-01-12T00:00:00Z' }] as unknown as Vacancy[]
      const { container } = render(<VacanciesTable rows={rows} />)
      const headerCell = screen.getByText('Leeftijd').closest('th') as HTMLElement
      const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
      const cell = container.querySelectorAll('tbody tr')[0].children[colIndex]
      expect(cell.textContent).toBe('3')
      expect(cell.textContent).not.toMatch(/d$/)
    } finally {
      vi.useRealTimers()
    }
  })
})
