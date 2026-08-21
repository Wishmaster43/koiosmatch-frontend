/**
 * DetailsRequirementsTab · V12 (VACATURES-100) regression guard for the
 * ervaring/senioriteit/opleiding fields. Mirrors DetailsLocationTab.test.tsx's
 * mocked-section convention (real i18n is NOT loaded in this suite, so `t()`
 * echoes the raw key — see DetailsTab.test.tsx's comment for why).
 *
 * DRILLDOWN-VOLGORDE-CANON (Danny 21-08, VACATURES 4): the required-skills
 * list moved off this component onto DescriptionTab (under the vacancy text) —
 * its own RequiredSkillsSection.test.tsx and DescriptionTab.test.tsx now cover
 * that behaviour; this component owns only the three field rows.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetailsRequirementsTab from './DetailsRequirementsTab'
import type { VacancyDetail } from '@/types/vacancy'
import type { RequirementsSection } from '../hooks/useVacancyDetailsForm'

const vacancy = {
  id: 'v1', experienceMin: '1', experienceMax: '3', seniority: 'Senior', education: 'HBO',
} as unknown as VacancyDetail

const seniorityLevels = [{ value: 'sen1', label: 'Senior' }]
const educationLevels = [{ value: 'edu1', label: 'HBO' }]

// One section's mock shape (mirrors DetailsLocationTab.test.tsx's makeLocation
// convention) — this sub-tab only ever reads/calls its OWN `requirements` section.
const makeRequirements = (overrides: Partial<RequirementsSection> = {}): RequirementsSection => ({
  editing: false, setEditing: vi.fn(),
  form: { experienceMin: '1', experienceMax: '3', seniority: 'sen1', education: 'edu1' },
  setF: vi.fn(), save: vi.fn(), cancel: vi.fn(),
  ...overrides,
})

describe('DetailsRequirementsTab · read/edit mode (V12)', () => {
  it('read mode shows experience/seniority/education from the vacancy', () => {
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={makeRequirements()} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    expect(screen.getByText('1 – 3 details.years')).toBeInTheDocument()
    expect(screen.getByText('Senior')).toBeInTheDocument()
    expect(screen.getByText('HBO')).toBeInTheDocument()
  })

  it('edit mode swaps in the experience/seniority/education inputs', () => {
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={makeRequirements({ editing: true })} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    expect(screen.getByPlaceholderText('details.experienceFrom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('details.experienceTo')).toBeInTheDocument()
    // G35: seniority/education are now the SAME searchable CreatableSelect as
    // AddVacancyModal's RequirementsCard — real <button> triggers, not native
    // <select> elements — each showing its currently picked level's label.
    expect(screen.getByRole('button', { name: 'Senior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'HBO' })).toBeInTheDocument()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  it('picking a seniority option calls setF with that level\'s value — same write path the old <select> used', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements({ editing: true })
    const levels = [{ value: 'sen1', label: 'Senior' }, { value: 'sen2', label: 'Junior' }]
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={levels} educationLevels={educationLevels} />)
    await user.click(screen.getByRole('button', { name: 'Senior' }))
    await user.click(screen.getByRole('button', { name: 'Junior' }))
    expect(requirements.setF).toHaveBeenCalledWith('seniority', 'sen2')
  })

  it('picking an education option calls setF with that level\'s value — same write path the old <select> used', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements({ editing: true })
    const levels = [{ value: 'edu1', label: 'HBO' }, { value: 'edu2', label: 'MBO' }]
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={levels} />)
    await user.click(screen.getByRole('button', { name: 'HBO' }))
    await user.click(screen.getByRole('button', { name: 'MBO' }))
    expect(requirements.setF).toHaveBeenCalledWith('education', 'edu2')
  })

  it('the pencil calls setEditing; Save/Cancel call the section\'s save/cancel', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements()
    const { rerender } = render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getByTitle('common:edit'))
    expect(requirements.setEditing).toHaveBeenCalledWith(true)

    const editing = makeRequirements({ editing: true, save: vi.fn(), cancel: vi.fn() })
    rerender(<DetailsRequirementsTab vacancy={vacancy} requirements={editing} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getByTitle('common:save'))
    expect(editing.save).toHaveBeenCalledTimes(1)
    await user.click(screen.getByTitle('common:cancel'))
    expect(editing.cancel).toHaveBeenCalledTimes(1)
  })
})
