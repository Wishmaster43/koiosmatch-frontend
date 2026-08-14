import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacanciesToolbar from './VacanciesToolbar'

// i18n is not initialised in tests → t() returns the key, so assertions drive on keys.
const baseProps = () => ({
  selectedCount: 0, bulkBar: <div>bulk-bar</div>, onAddOpen: () => {},
  searchEpoch: 0, globalSearch: '', onSearch: () => {},
  anyFilterActive: false, onClearFilters: () => {},
  showArchived: false, onToggleArchived: () => {},
  showTrash: false, onToggleTrash: () => {},
  mapActive: false, onToggleView: () => {},
})

// EXCEL-VACATURES-1 (Danny 14-08, screenshot: "Excel importeren moet in de pop-up
// + nieuwe vacature niet hier boven de tabel!!"): the Excel/CSV import button
// used to live here next to "+ Nieuwe vacature" — it moved into AddVacancyModal's
// header (mirrors KLANT-LAYOUT-3). This is the regression guard: the toolbar must
// never grow it back.
describe('VacanciesToolbar · import button removed (EXCEL-VACATURES-1)', () => {
  it('renders the add/search/toggle row without any Excel/CSV import affordance', () => {
    render(<VacanciesToolbar {...baseProps()} />)
    expect(screen.getByText('+ page.add')).toBeInTheDocument()
    // The old toolbar button's own i18n keys — neither must ever render again here.
    expect(screen.queryByText('page.import')).toBeNull()
    expect(screen.queryByTitle('page.importTitle')).toBeNull()
    // No stray import-only affordance among the toolbar's buttons at all.
    expect(screen.queryAllByRole('button').some(btn => /import/i.test(btn.textContent ?? ''))).toBe(false)
  })

  it('still fires onAddOpen — the toolbar keeps its other behaviour unchanged', async () => {
    const user = userEvent.setup()
    const props = baseProps()
    let added = false
    render(<VacanciesToolbar {...props} onAddOpen={() => { added = true }} />)
    await user.click(screen.getByText('+ page.add'))
    expect(added).toBe(true)
  })
})
