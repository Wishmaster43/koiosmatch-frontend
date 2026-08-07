/**
 * DetailsRequirementsTab · V12 (VACATURES-100) regression guard: "Vereiste
 * vaardigheden doet niets" ("required skills does nothing"). MEASURED live
 * (2026-08-07) against the real API — PATCH /vacancies/{id} with a `skills`
 * array persists and round-trips correctly (UpdateVacancyRequest validates
 * `skills`/`skills.*`, VacancyWriter::syncRelations replaces the child rows).
 * The hook-level PATCH-body assembly is covered by useVacancyDetailsForm.test.ts
 * ('skills add/remove persists immediately …' / '… rides along with the Eisen
 * Save …'); THIS file guards the leaf component's OWN wiring — the exact class
 * of bug S20 was ("tab gave DetailsTab no onUpdate — every pencil no-op'd
 * silently") lives one layer up, but a component that stopped calling
 * `requirements.addSkill`/`removeSkill` at all would silently break the same
 * feature from here. Mirrors DetailsLocationTab.test.tsx's mocked-section
 * convention (real i18n is NOT loaded in this suite, so `t()` echoes the raw
 * key — see DetailsTab.test.tsx's comment for why).
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
  skills: ['Triage', 'Wondzorg'], newSkill: '', setNewSkill: vi.fn(), addSkill: vi.fn(), removeSkill: vi.fn(),
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
    // Two <select> elements: seniority + education.
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
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

describe('DetailsRequirementsTab · required-skills list (V12 "doet niets")', () => {
  it('renders every skill as its own row with a remove button', () => {
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={makeRequirements()} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    expect(screen.getByText('Triage')).toBeInTheDocument()
    expect(screen.getByText('Wondzorg')).toBeInTheDocument()
    expect(screen.getAllByTitle('common:remove')).toHaveLength(2)
  })

  it('renders no list block when there are no skills yet (only the add row)', () => {
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={makeRequirements({ skills: [] })} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    expect(screen.queryByTitle('common:remove')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('details.addSkill')).toBeInTheDocument()
  })

  it('clicking the remove icon calls removeSkill with THAT skill, not the whole list', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements()
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getAllByTitle('common:remove')[1])
    expect(requirements.removeSkill).toHaveBeenCalledWith('Wondzorg')
  })

  it('typing a new skill calls setNewSkill; the + button calls addSkill', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements()
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'B')
    expect(requirements.setNewSkill).toHaveBeenCalledWith('B')
    await user.click(screen.getByTitle('details.addSkill'))
    expect(requirements.addSkill).toHaveBeenCalledTimes(1)
  })

  it('pressing Enter in the skill input also calls addSkill (no need to reach for the mouse)', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements({ newSkill: 'BIG-registratie' })
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.type(screen.getByPlaceholderText('details.addSkill'), '{Enter}')
    expect(requirements.addSkill).toHaveBeenCalledTimes(1)
  })

  it('the quick-add/remove skill controls work identically OUTSIDE and INSIDE the Eisen pencil (§ file docblock: rides along with Save while open)', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements({ editing: true })
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getByTitle('details.addSkill'))
    expect(requirements.addSkill).toHaveBeenCalledTimes(1)
    await user.click(screen.getAllByTitle('common:remove')[0])
    expect(requirements.removeSkill).toHaveBeenCalledWith('Triage')
  })
})
