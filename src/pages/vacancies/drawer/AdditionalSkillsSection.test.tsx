/**
 * AdditionalSkillsSection · VACANCY-SKILLS-PARITY-1 (Danny 08-08) regression
 * guard: the vacancy required-skills list now uses the SAME AddableSection
 * idiom as the candidate drawer's (frozen canon) SkillsTab — a "+ Toevoegen"
 * trigger revealing an inline add form, per-row pencil (edit-in-place) +
 * trash (remove), never the old always-visible text+"+" row with remove-only
 * X buttons. No i18n resources are loaded in this suite (component + its
 * AddableSection/AddForm chain never import `@/i18n`), so every `t()` call
 * echoes either its bare key or its `defaultValue` — see the exact strings
 * asserted below (verified against the real, uninitialized react-i18next
 * fallback behaviour, not guessed).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdditionalSkillsSection from './AdditionalSkillsSection'

describe('AdditionalSkillsSection · list rendering (§3B: vertical list, never chips)', () => {
  it('renders every skill as its own row, each with its OWN pencil + trash', () => {
    render(<AdditionalSkillsSection skills={['Triage', 'Wondzorg']} onAddSkill={vi.fn()} onEditSkill={vi.fn()} onRemoveSkill={vi.fn()} />)
    expect(screen.getByText('Triage')).toBeInTheDocument()
    expect(screen.getByText('Wondzorg')).toBeInTheDocument()
    expect(screen.getAllByTitle('Bewerken')).toHaveLength(2)
    expect(screen.getAllByTitle('Verwijderen')).toHaveLength(2)
  })

  it('shows the empty-state text and the add trigger when there are no skills yet', () => {
    render(<AdditionalSkillsSection skills={[]} onAddSkill={vi.fn()} onEditSkill={vi.fn()} onRemoveSkill={vi.fn()} />)
    expect(screen.getByText('No required skills yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /details\.addSkill/ })).toBeInTheDocument()
  })
})

describe('AdditionalSkillsSection · add flow (same idiom as the candidate SkillsTab)', () => {
  it('the "+" trigger reveals an inline add form (no always-visible input)', async () => {
    const user = userEvent.setup()
    render(<AdditionalSkillsSection skills={[]} onAddSkill={vi.fn()} onEditSkill={vi.fn()} onRemoveSkill={vi.fn()} />)
    expect(screen.queryByPlaceholderText('details.addSkill')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    expect(screen.getByPlaceholderText('details.addSkill')).toBeInTheDocument()
  })

  it('saving the add form calls onAddSkill with the trimmed typed name', async () => {
    const user = userEvent.setup()
    const onAddSkill = vi.fn()
    render(<AdditionalSkillsSection skills={[]} onAddSkill={onAddSkill} onEditSkill={vi.fn()} onRemoveSkill={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), '  BIG-registratie  ')
    await user.click(screen.getByTitle('save'))
    expect(onAddSkill).toHaveBeenCalledWith('BIG-registratie')
  })

  it('cancelling the add form closes it without calling onAddSkill', async () => {
    const user = userEvent.setup()
    const onAddSkill = vi.fn()
    render(<AdditionalSkillsSection skills={[]} onAddSkill={onAddSkill} onEditSkill={vi.fn()} onRemoveSkill={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /details\.addSkill/ }))
    await user.type(screen.getByPlaceholderText('details.addSkill'), 'Wondzorg')
    await user.click(screen.getByTitle('cancel'))
    expect(onAddSkill).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText('details.addSkill')).not.toBeInTheDocument()
  })
})

describe('AdditionalSkillsSection · per-row edit (real rename, not remove+re-add)', () => {
  it('the row pencil opens the SAME form prefilled with that row\'s value', async () => {
    const user = userEvent.setup()
    render(<AdditionalSkillsSection skills={['Triage', 'Wondzorg']} onAddSkill={vi.fn()} onEditSkill={vi.fn()} onRemoveSkill={vi.fn()} />)
    await user.click(screen.getAllByTitle('Bewerken')[1])
    expect(screen.getByPlaceholderText('details.addSkill')).toHaveValue('Wondzorg')
  })

  it('saving the edit form calls onEditSkill with (index, newName) — the row keeps its position', async () => {
    const user = userEvent.setup()
    const onEditSkill = vi.fn()
    const onRemoveSkill = vi.fn()
    render(<AdditionalSkillsSection skills={['Triage', 'Wondzorg']} onAddSkill={vi.fn()} onEditSkill={onEditSkill} onRemoveSkill={onRemoveSkill} />)
    await user.click(screen.getAllByTitle('Bewerken')[1])
    const input = screen.getByPlaceholderText('details.addSkill')
    await user.clear(input)
    await user.type(input, 'Wondverzorging')
    await user.click(screen.getByTitle('save'))
    expect(onEditSkill).toHaveBeenCalledWith(1, 'Wondverzorging')
    // A real in-place rename never goes through remove.
    expect(onRemoveSkill).not.toHaveBeenCalled()
  })
})

describe('AdditionalSkillsSection · per-row remove', () => {
  it('the row trash calls onRemoveSkill with THAT row\'s value, not an index or the whole list', async () => {
    const user = userEvent.setup()
    const onRemoveSkill = vi.fn()
    render(<AdditionalSkillsSection skills={['Triage', 'Wondzorg']} onAddSkill={vi.fn()} onEditSkill={vi.fn()} onRemoveSkill={onRemoveSkill} />)
    await user.click(screen.getAllByTitle('Verwijderen')[1])
    expect(onRemoveSkill).toHaveBeenCalledWith('Wondzorg')
  })
})
