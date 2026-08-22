/**
 * OpportunitiesTable — the reference-number column (NUMMER-1). Mirrors
 * MatchesTable.test.tsx: real (nl) i18n, mocked useAllSettings/useDateFormat.
 * The column is what makes the number you just searched for scannable in the
 * list; without it a ?ref= hit lands on a row that shows no number at all.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunitiesTable from './OpportunitiesTable'
import type { Opportunity } from '@/types/opportunity'

vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getBoolSetting: (_s: unknown, _key: string, fallback: boolean) => fallback,
}))
// DD-MM-YYYY date formatter mock (mirrors the house formatter's notation) — DATUM-1:
// the date cells must prove the house format renders, never raw ISO (Opus-check 22-08).
vi.mock('@/lib/datetime', () => ({
  useLocale: () => 'nl-NL',
  useDateFormat: () => ({
    formatDate: (v: unknown) => (v == null ? '—' : String(v).split('-').reverse().join('-')),
    formatDateTime: (v: unknown) => String(v),
  }),
}))
// Real (nl) translations, since mocking '@/lib/datetime' above removes the
// transitive '@/i18n' side-effect import the production component relies on.
import '@/i18n'

const baseRow = {
  id: 'o1', title: 'Detachering ICU', initials: 'DI', client: 'Zorgpartners',
  stage: 'Lead', stageValue: 'lead', stageColor: null, value: null, hours: null,
  owner: '', date: '2026-01-01', expectedCloseAt: null, archived: false,
} as unknown as Opportunity

describe('OpportunitiesTable · reference number column (NUMMER-1)', () => {
  it('renders the real referenceNumber value, and a plain dash when absent — never a blank cell', () => {
    const withRef = { ...baseRow, id: 'o10', referenceNumber: 'KA-00042' }
    const withoutRef = { ...baseRow, id: 'o11', referenceNumber: '' }
    const { container } = render(<OpportunitiesTable rows={[withRef, withoutRef]} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const values = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[col].textContent)
    expect(values).toContain('KA-00042')
    expect(values).toContain('—')
  })

  it('sorts by reference number when the column header is clicked', async () => {
    const user = userEvent.setup()
    const rows = [
      { ...baseRow, id: 'o20', referenceNumber: 'KA-00003' },
      { ...baseRow, id: 'o21', referenceNumber: 'KA-00001' },
      { ...baseRow, id: 'o22', referenceNumber: 'KA-00002' },
    ]
    const { container } = render(<OpportunitiesTable rows={rows} />)

    const headerCell = screen.getByText('Referentienr.').closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    await user.click(within(headerCell).getByRole('button'))

    const values = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[col].textContent)
    expect(values).toEqual(['KA-00001', 'KA-00002', 'KA-00003'])
  })
})

// Danny 05-08: the "Koios" column now rolls out to every entity table — this is
// the smoke test proving the header renders here too (the honest per-row rule
// lives in opportunityAdvice.test.ts).
describe('OpportunitiesTable · Koios column (Danny 05-08)', () => {
  it('renders the header with the Koios mark, and flags an overdue, still-open deal', () => {
    const overdue = { ...baseRow, id: 'o30', stageValue: 'lead', expectedCloseAt: '2000-01-01' }
    const onTrack = { ...baseRow, id: 'o31', stageValue: 'lead', expectedCloseAt: null }
    render(<OpportunitiesTable rows={[overdue, onTrack]} />)

    expect(screen.getByRole('img', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByText('Opvolgen')).toBeInTheDocument()
  })

  it('renders an honest dash for a deal with no expected-close date', () => {
    const onTrack = { ...baseRow, id: 'o32', stageValue: 'lead', expectedCloseAt: null }
    const { container } = render(<OpportunitiesTable rows={[onTrack]} />)
    const headerCell = screen.getByRole('img', { name: 'Koios AI' }).closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    expect(container.querySelectorAll('tbody tr')[0].children[col].textContent).toBe('—')
  })
})

// K10c-repair: the value column must render through the shared opportunityValue
// helper (same one the customer drawer's OpportunitiesTab uses) in both euro
// and hours mode — proving the page no longer carries its own formatter.
describe('OpportunitiesTable · value column via shared opportunityValue helper', () => {
  const getValueCell = (container: HTMLElement) => {
    const headerCell = screen.getByText('Waarde').closest('th') as HTMLElement
    const col = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    return container.querySelectorAll('tbody tr')[0].children[col]
  }

  it('formats a euro value with the shared nl-NL EUR formatter (euro mode)', () => {
    const row = { ...baseRow, id: 'o40', value: 12500, hours: null }
    const { container } = render(<OpportunitiesTable rows={[row]} valueInHours={false} />)
    expect(getValueCell(container).textContent).toBe('€ 12.500')
  })

  it('formats an hours value via the shared i18n key (hours mode)', () => {
    const row = { ...baseRow, id: 'o41', value: null, hours: 40 }
    const { container } = render(<OpportunitiesTable rows={[row]} valueInHours={true} />)
    expect(getValueCell(container).textContent).toBe('40 u')
  })
})

// KANSEN-A-4: contract-term columns (start/end date), added after the value
// column — plain info, muted dash when empty, sortable, unlinked until Danny
// answers the CEL-DOORKLIK routing question (OPP-DATE-ROUTE). Dates assert the
// house DD-MM-YYYY notation (DATUM-1), never raw ISO.
describe('OpportunitiesTable · start/end date columns', () => {
  const getCol = (header: string) => {
    const headerCell = screen.getByText(header).closest('th') as HTMLElement
    return Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
  }

  it('renders the real dates, and an honest dash when unset — never a blank cell', () => {
    const withDates = { ...baseRow, id: 'o50', startDate: '2026-03-01', endDate: '2026-09-30' }
    const withoutDates = { ...baseRow, id: 'o51', startDate: null, endDate: null }
    const { container } = render(<OpportunitiesTable rows={[withDates, withoutDates]} />)

    // Unordered containment (mirrors the referenceNumber test above) — the
    // table's own default sort (by `date`) may reorder these two identical-date
    // rows, so row POSITION is not asserted, only that both values are present.
    const startCol = getCol('Startdatum')
    const endCol = getCol('Einddatum')
    const startValues = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[startCol].textContent)
    const endValues = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[endCol].textContent)
    expect(startValues).toContain('01-03-2026')
    expect(startValues).toContain('—')
    expect(endValues).toContain('30-09-2026')
    expect(endValues).toContain('—')
  })

  it('sorts by start date when the column header is clicked', async () => {
    const user = userEvent.setup()
    const rows = [
      { ...baseRow, id: 'o60', startDate: '2026-06-01' },
      { ...baseRow, id: 'o61', startDate: '2026-01-01' },
      { ...baseRow, id: 'o62', startDate: '2026-03-01' },
    ]
    const { container } = render(<OpportunitiesTable rows={rows} />)
    const startCol = getCol('Startdatum')
    const headerCell = screen.getByText('Startdatum').closest('th') as HTMLElement
    await user.click(within(headerCell).getByRole('button'))

    const values = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[startCol].textContent)
    // Display is DD-MM-YYYY while the sort key stays the raw ISO date — the
    // expected order below proves sortValue reads the data, not the rendering.
    expect(values).toEqual(['01-01-2026', '01-03-2026', '01-06-2026'])
  })

  it('sorts by end date when the column header is clicked', async () => {
    const user = userEvent.setup()
    const rows = [
      { ...baseRow, id: 'o70', endDate: '2026-12-01' },
      { ...baseRow, id: 'o71', endDate: '2026-02-01' },
      { ...baseRow, id: 'o72', endDate: '2026-07-01' },
    ]
    const { container } = render(<OpportunitiesTable rows={rows} />)
    const endCol = getCol('Einddatum')
    const headerCell = screen.getByText('Einddatum').closest('th') as HTMLElement
    await user.click(within(headerCell).getByRole('button'))

    const values = Array.from(container.querySelectorAll('tbody tr')).map(r => r.children[endCol].textContent)
    expect(values).toEqual(['01-02-2026', '01-07-2026', '01-12-2026'])
  })
})
