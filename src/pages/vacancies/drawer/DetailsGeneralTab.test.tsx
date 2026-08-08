/**
 * DetailsGeneralTab · G35 regression guard: function/industry now use the SAME
 * searchable CreatableSelect as AddVacancyModal's GeneralCard — was a native
 * <select> here, a different control for the exact same lookup data. This
 * only covers the NEW control wiring (picking an option still calls the
 * section's OWN `setF` with the same key/value the old <select> wrote, so the
 * hook's PATCH-body assembly, already covered by useVacancyDetailsForm.test.ts,
 * is untouched); it does not re-test contract-type chips or the client cascade.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetailsGeneralTab from './DetailsGeneralTab'
import type { VacancyDetail } from '@/types/vacancy'
import type { GeneralSection } from '../hooks/useVacancyDetailsForm'

const vacancy = {
  id: 'v1', clientId: 'c1', clientName: 'Rivas Zorggroep', category: 'Verpleegkundige', industry: 'Zorg',
} as unknown as VacancyDetail

const fnOptions = [{ value: 'Verpleegkundige', label: 'Verpleegkundige' }, { value: 'Helpende', label: 'Helpende' }]
const industries = ['Zorg', 'Onderwijs']

// One section's mock shape (mirrors DetailsRequirementsTab.test.tsx's makeRequirements
// convention) — this sub-tab only ever reads/calls its OWN `general` section.
const makeGeneral = (overrides: Partial<GeneralSection> = {}): GeneralSection => ({
  editing: false, setEditing: vi.fn(),
  form: { category: 'Verpleegkundige', industry: 'Zorg', startDate: '', endDate: '' },
  setF: vi.fn(), save: vi.fn(), cancel: vi.fn(),
  clientId: 'c1', handleClientChange: vi.fn(), customerOptions: [],
  cascade: { locationId: '', locationName: '', departmentId: '', departmentName: '', contactId: '', contactName: '' },
  locationPicker: null, departmentPicker: null, contactPicker: null,
  types: [], toggleType: vi.fn(),
  ...overrides,
})

describe('DetailsGeneralTab · function/industry pickers (G35)', () => {
  it('edit mode shows the function/industry triggers as searchable CreatableSelect buttons, not a native <select>', () => {
    render(<DetailsGeneralTab vacancy={vacancy} general={makeGeneral({ editing: true })}
      candidateTypes={[]} typeMeta={() => ({ label: '', color: '#000' })}
      industries={industries} fnOptions={fnOptions} formatDate={d => d} />)
    // Each trigger is a real <button> (CreatableSelect), showing its current value's label.
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zorg' })).toBeInTheDocument()
    // No leftover native <select> for these two fields.
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('picking a function option calls setF("category", …) — the same write path the old <select> used', async () => {
    const user = userEvent.setup()
    const general = makeGeneral({ editing: true })
    render(<DetailsGeneralTab vacancy={vacancy} general={general}
      candidateTypes={[]} typeMeta={() => ({ label: '', color: '#000' })}
      industries={industries} fnOptions={fnOptions} formatDate={d => d} />)
    await user.click(screen.getByRole('button', { name: 'Verpleegkundige' }))
    await user.click(screen.getByRole('button', { name: 'Helpende' }))
    expect(general.setF).toHaveBeenCalledWith('category', 'Helpende')
  })

  it('picking an industry option calls setF("industry", …) — the same write path the old <select> used', async () => {
    const user = userEvent.setup()
    const general = makeGeneral({ editing: true })
    render(<DetailsGeneralTab vacancy={vacancy} general={general}
      candidateTypes={[]} typeMeta={() => ({ label: '', color: '#000' })}
      industries={industries} fnOptions={fnOptions} formatDate={d => d} />)
    await user.click(screen.getByRole('button', { name: 'Zorg' }))
    await user.click(screen.getByRole('button', { name: 'Onderwijs' }))
    expect(general.setF).toHaveBeenCalledWith('industry', 'Onderwijs')
  })

  it('read mode shows the plain function/industry values, no picker', () => {
    render(<DetailsGeneralTab vacancy={vacancy} general={makeGeneral()}
      candidateTypes={[]} typeMeta={() => ({ label: '', color: '#000' })}
      industries={industries} fnOptions={fnOptions} formatDate={d => d} />)
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Zorg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Helpende' })).not.toBeInTheDocument()
  })
})
