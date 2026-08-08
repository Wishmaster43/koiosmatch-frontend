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
  skills: ['Triage', 'Wondzorg'], addSkill: vi.fn(), editSkill: vi.fn(), removeSkill: vi.fn(),
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

// VACANCY-SKILLS-PARITY-1 (Danny 08-08): the skills list now renders through
// RequiredSkillsSection (shared AddableSection) — same per-row pencil+trash
// idiom as the candidate drawer's SkillsTab, replacing the old always-visible
// text+"+" row. This describe block guards THIS component's own wiring: the
// props it hands to RequiredSkillsSection reach the right `requirements.*`
// function. RequiredSkillsSection's own add/edit/remove mechanics (the shared
// AddForm/AddableSection plumbing) are covered by RequiredSkillsSection.test.tsx.
describe('DetailsRequirementsTab · required-skills list (VACANCY-SKILLS-PARITY-1)', () => {
  it('renders every skill as its own row with edit AND remove controls (never remove-only)', () => {
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={makeRequirements()} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    expect(screen.getByText('Triage')).toBeInTheDocument()
    expect(screen.getByText('Wondzorg')).toBeInTheDocument()
    // Per-row pencil AND trash — the old interaction only ever had an X (remove).
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(2)
    expect(screen.getAllByTitle('Verwijderen')).toHaveLength(2)
  })

  it('renders the empty state and the "+ add" trigger when there are no skills yet', () => {
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={makeRequirements({ skills: [] })} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    expect(screen.queryByTitle('Verwijderen')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /details\.addSkill/ })).toBeInTheDocument()
  })

  it('clicking the remove icon calls removeSkill with THAT skill, not the whole list', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements()
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getAllByTitle('Verwijderen')[1])
    expect(requirements.removeSkill).toHaveBeenCalledWith('Wondzorg')
  })

  it('the "+ add" trigger reveals an inline form; saving it calls addSkill with the typed name', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements()
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'BIG-registratie')
    await user.click(screen.getByTitle('save'))
    expect(requirements.addSkill).toHaveBeenCalledWith('BIG-registratie')
  })

  it('the pencil opens the SAME add form prefilled with the row\'s value; saving calls editSkill(index, newName) — a real rename, not remove+re-add', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements()
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getAllByTitle('Bewerken')[1])
    const input = screen.getByPlaceholderText('details.addSkill')
    expect(input).toHaveValue('Wondzorg')
    await user.clear(input)
    await user.type(input, 'Wondverzorging')
    await user.click(screen.getByTitle('save'))
    expect(requirements.editSkill).toHaveBeenCalledWith(1, 'Wondverzorging')
    expect(requirements.removeSkill).not.toHaveBeenCalled()
  })

  it('the quick-add/remove skill controls work identically OUTSIDE and INSIDE the Eisen pencil (§ file docblock: rides along with Save while open)', async () => {
    const user = userEvent.setup()
    const requirements = makeRequirements({ editing: true })
    render(<DetailsRequirementsTab vacancy={vacancy} requirements={requirements} seniorityLevels={seniorityLevels} educationLevels={educationLevels} />)
    await user.click(screen.getAllByTitle('Verwijderen')[0])
    expect(requirements.removeSkill).toHaveBeenCalledWith('Triage')
  })
})
