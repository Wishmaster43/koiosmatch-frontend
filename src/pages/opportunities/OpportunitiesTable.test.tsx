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
// Identity date formatter + nl locale — this file doesn't cover date rendering itself.
vi.mock('@/lib/datetime', () => ({
  useLocale: () => 'nl-NL',
  useDateFormat: () => ({ formatDate: (v: unknown) => (v == null ? '—' : String(v)), formatDateTime: (v: unknown) => String(v) }),
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
