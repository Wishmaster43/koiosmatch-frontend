/** VacanciesTable · sorting, seeded labels and cell links (split from VacanciesTable.test.tsx; each file carries the mocks its own tests need). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Real i18n (nl) side-effect init so the "AI-agent" column header resolves genuine
// Dutch text (mirrors VacancyDrawer.test.tsx's convention). Default-exported so the
// seeded-label test below can switch languages (mirrors Sidebar.test.jsx).
import i18n from '@/i18n'
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

// Minimal rows — only the fields the table's columns actually read; cast past the
// full Vacancy shape (mirrors DetailsTab.test.tsx's VacancyDetail cast). Explicit
// distinct createdSort values so the table's real newest-first defaultSort (the
// VAC-KPI-REDESIGN 22-07 meelift-fix) doesn't reorder rows out from under this test.
const rows = [
  { id: 'v1', title: 'Verpleegkundige', aiAgentName: 'Kelly', created: '2024-02-01', createdSort: '2024-02-01' },
  { id: 'v2', title: 'Doktersassistent', aiAgentName: '', created: '2024-01-01', createdSort: '2024-01-01' },
] as unknown as Vacancy[]

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

// LOOKUP-I18N-1: the row's embedded `statusLabel` is the seed default while
// untouched — render it in the user's language; a tenant rename stays as typed.
// Mirrors Sidebar.test.jsx's changeLanguage convention.
describe('VacanciesTable · seeded status label i18n (LOOKUP-I18N-1)', () => {
  it('renders the seeded status in English when the UI language is English', async () => {
    await i18n.changeLanguage('en')
    const seededRows = [
      { id: 'v1', title: 'A', statusValue: 'concept', statusLabel: 'Concept', published: true, created: '2024-01-01', createdSort: '2024-01-01' },
    ] as unknown as Vacancy[]
    const { unmount } = render(<VacanciesTable rows={seededRows} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.queryByText('Concept')).not.toBeInTheDocument()
    // Unmount before switching back — resetting the language on a still-mounted
    // component would fire a state update outside act().
    unmount()
    await i18n.changeLanguage('nl')
  })

  it('leaves a tenant-renamed status label untouched under English', async () => {
    await i18n.changeLanguage('en')
    const renamedRows = [
      { id: 'v1', title: 'A', statusValue: 'concept', statusLabel: 'Werving gepauzeerd', published: true, created: '2024-01-01', createdSort: '2024-01-01' },
    ] as unknown as Vacancy[]
    const { unmount } = render(<VacanciesTable rows={renamedRows} />)
    expect(screen.getByText('Werving gepauzeerd')).toBeInTheDocument()
    unmount()
    await i18n.changeLanguage('nl')
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
    expect(screen.getByText(i18n.t('common:koios.actions.attention'))).toBeInTheDocument()
  })

  it('renders an honest dash for an unpublished vacancy, even with zero applications', () => {
    const draft = { id: 'v3', title: 'Concept', published: false, archived: false, applicationsCount: 0, created: '2000-01-01', createdSort: '2000-01-01' } as unknown as Vacancy
    const { container } = render(<VacanciesTable rows={[draft]} />)
    const headerCell = screen.getByRole('img', { name: 'Koios AI' }).closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[col].textContent).toBe('—')
  })
})

describe('VacanciesTable · client cell deep-link', () => {
  it('opens the customers drill-down and never the row onSelect', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const row = {
      id: 'v90', title: 'Verpleegkundige', clientName: 'Zorgpartners', clientId: 'c-77',
      published: true, archived: false, applicationsCount: 0, created: '2000-01-01', createdSort: '2000-01-01',
    } as unknown as Vacancy
    render(<VacanciesTable rows={[row]} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /Open klant/ }))

    expect(openEntity).toHaveBeenCalledWith('customers', 'c-77')
    expect(onSelect).not.toHaveBeenCalled()
  })
})
