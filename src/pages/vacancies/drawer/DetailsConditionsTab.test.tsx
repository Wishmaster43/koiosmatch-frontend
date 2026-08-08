/**
 * DetailsConditionsTab · SWEEP-NATIVE-SELECT regression guard: contract-form/
 * CAO now use the SAME searchable CreatableSelect as AddVacancyModal's
 * match-vocabulary pickers — was a native <select> here, a different control
 * for the same lookup data (mirrors G35's identical fix to DetailsGeneralTab's
 * function/industry fields). This only covers the NEW control wiring (picking
 * an option still calls the section's OWN `setF` with the same key/value the
 * old <select> wrote, so the PATCH body is unchanged); it does not re-test
 * salary/hours.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetailsConditionsTab from './DetailsConditionsTab'
import type { VacancyDetail } from '@/types/vacancy'
import type { ConditionsSection } from '../hooks/useVacancyDetailsForm'

const vacancy = {
  id: 'v1', contractType: 'freelance', cao: 'zorg', salaryMin: '', salaryMax: '', hoursMin: '', hoursMax: '',
} as unknown as VacancyDetail

const contractTypeOptions = [{ value: 'freelance', label: 'Freelance' }, { value: 'payroll', label: 'Payroll' }]
const caoOptions = [{ value: 'zorg', label: 'CAO Zorg' }, { value: 'welzijn', label: 'CAO Welzijn' }]

// One section's mock shape (mirrors DetailsGeneralTab.test.tsx's makeGeneral
// convention) — this sub-tab only ever reads/calls its OWN `conditions` section.
const makeConditions = (overrides: Partial<ConditionsSection> = {}): ConditionsSection => ({
  editing: false, setEditing: vi.fn(),
  form: { salaryMin: '', salaryMax: '', hoursMin: '', hoursMax: '', contractType: 'freelance', cao: 'zorg' },
  setF: vi.fn(), save: vi.fn(), cancel: vi.fn(),
  ...overrides,
})

describe('DetailsConditionsTab · contract-form/CAO pickers (SWEEP-NATIVE-SELECT)', () => {
  it('edit mode shows the contract-form/CAO triggers as searchable CreatableSelect buttons, not a native <select>', () => {
    render(<DetailsConditionsTab vacancy={vacancy} conditions={makeConditions({ editing: true })}
      contractTypeOptions={contractTypeOptions} caoOptions={caoOptions} />)
    // Each trigger is a real <button> (CreatableSelect), showing its current value's label.
    expect(screen.getByRole('button', { name: 'Freelance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CAO Zorg' })).toBeInTheDocument()
    // No leftover native <select> for these two fields.
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('picking a contract-form option calls setF("contractType", …) — the same write path the old <select> used', async () => {
    const user = userEvent.setup()
    const conditions = makeConditions({ editing: true })
    render(<DetailsConditionsTab vacancy={vacancy} conditions={conditions}
      contractTypeOptions={contractTypeOptions} caoOptions={caoOptions} />)
    await user.click(screen.getByRole('button', { name: 'Freelance' }))
    await user.click(screen.getByRole('button', { name: 'Payroll' }))
    expect(conditions.setF).toHaveBeenCalledWith('contractType', 'payroll')
  })

  it('picking a CAO option calls setF("cao", …) — the same write path the old <select> used', async () => {
    const user = userEvent.setup()
    const conditions = makeConditions({ editing: true })
    render(<DetailsConditionsTab vacancy={vacancy} conditions={conditions}
      contractTypeOptions={contractTypeOptions} caoOptions={caoOptions} />)
    await user.click(screen.getByRole('button', { name: 'CAO Zorg' }))
    await user.click(screen.getByRole('button', { name: 'CAO Welzijn' }))
    expect(conditions.setF).toHaveBeenCalledWith('cao', 'welzijn')
  })

  it('read mode shows the plain contract-form/CAO labels, no picker', () => {
    render(<DetailsConditionsTab vacancy={vacancy} conditions={makeConditions()}
      contractTypeOptions={contractTypeOptions} caoOptions={caoOptions} />)
    expect(screen.getByText('Freelance')).toBeInTheDocument()
    expect(screen.getByText('CAO Zorg')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Payroll' })).not.toBeInTheDocument()
  })
})
