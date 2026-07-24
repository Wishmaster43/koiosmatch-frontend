import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n (nl) side-effect init so real Dutch column/status text resolves —
// mirrors VacanciesTable.test.tsx's convention.
import '@/i18n'
import SmCandidatesTable from './SmCandidatesTable'
import type { ReportCandidate } from '@/types/reports'

const rows: ReportCandidate[] = [
  {
    id: 'c1', firstname: 'Anna', lastname: 'Jansen', email: 'anna@example.com',
    position: 'Verpleegkundige', status: 'actief', end_date_employment: '2026-03-15',
  },
  {
    id: 'c2', firstname: 'Bram', lastname: 'de Vries', status: 'nietactief',
    // No end_date_employment — the column must show an em-dash, not blow up.
  },
]

describe('SmCandidatesTable · columns', () => {
  it('renders the mirrored reports column headers plus the new Uitschrijfdatum column', () => {
    render(<SmCandidatesTable rows={rows} />)
    expect(screen.getByText('Naam')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Functie')).toBeInTheDocument()
    expect(screen.getByText('Uitschrijfdatum')).toBeInTheDocument()
  })

  it('renders the row names and a soft status chip (not a solid fill)', () => {
    render(<SmCandidatesTable rows={rows} />)
    expect(screen.getByText('Anna Jansen')).toBeInTheDocument()
    expect(screen.getByText('Bram de Vries')).toBeInTheDocument()

    const chip = screen.getByText('Actief')
    // SoftChip tints via color-mix — never a solid background (§4).
    expect(chip.closest('span')).toHaveStyle({ background: 'color-mix(in srgb, var(--color-success) 10%, transparent)' })
  })
})

describe('SmCandidatesTable · Uitschrijfdatum column (end_date_employment)', () => {
  it('formats a present date as DD-MM-YYYY and shows an em-dash when absent', () => {
    const { container } = render(<SmCandidatesTable rows={rows} />)
    const headerCell = screen.getByText('Uitschrijfdatum').closest('th') as HTMLElement
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const tableRows = container.querySelectorAll('tbody tr')

    expect(tableRows[0].children[colIndex].textContent).toBe('15-03-2026')
    expect(tableRows[1].children[colIndex].textContent).toBe('—')
  })

  it('is sortable by the underlying date value', async () => {
    // Give the ALPHABETICALLY-LATER candidate the date, so the default name-sort
    // order and the endEmployment-sort order genuinely differ — a real reorder,
    // not a coincidence of the fixture's name order.
    const sortRows: ReportCandidate[] = [
      { id: 'c1', firstname: 'Anna', lastname: 'Jansen', status: 'actief' },
      { id: 'c2', firstname: 'Bram', lastname: 'de Vries', status: 'nietactief', end_date_employment: '2026-03-15' },
    ]
    const { container } = render(<SmCandidatesTable rows={sortRows} />)
    const headerCell = screen.getByText('Uitschrijfdatum').closest('th') as HTMLElement
    fireEvent.click(headerCell)
    const colIndex = Array.from(headerCell.parentElement?.children ?? []).indexOf(headerCell)
    const tableRows = container.querySelectorAll('tbody tr')
    // Ascending: the dated row (Bram) sorts before the undated one (DataTable's
    // compare() rule puts empty last) — the opposite of the default name order.
    expect(tableRows[0].children[colIndex].textContent).toBe('15-03-2026')
    expect(tableRows[1].children[colIndex].textContent).toBe('—')
  })
})
