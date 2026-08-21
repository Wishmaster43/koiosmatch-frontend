/**
 * useVacancySkills · DRILLDOWN-VOLGORDE-CANON (Danny 21-08, VACATURES 4): the
 * required-skills list extracted out of useVacancyDetailsForm's Eisen section
 * onto its own hook, now that the list lives on the Vacaturetekst tab.
 * Persistence is ALWAYS immediate — the old "ride along with the Eisen Save"
 * coupling died with the move (there is no sibling pencil on this tab).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVacancySkills } from './useVacancySkills'
import type { VacancyDetail } from '@/types/vacancy'

const vacancy = (over: Partial<VacancyDetail> = {}): VacancyDetail => ({ id: 'v1', skills: [], ...over } as unknown as VacancyDetail)

describe('useVacancySkills · add/edit/remove always persist immediately', () => {
  it('addSkill trims, dedupes, and PATCHes the updated array', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancySkills(vacancy(), onUpdate))
    act(() => { result.current.addSkill('  Triage  ') })
    expect(result.current.skills).toEqual(['Triage'])
    expect(onUpdate).toHaveBeenCalledWith('v1', { skills: ['Triage'] })
    // A duplicate (even with surrounding whitespace) never doubles the entry.
    act(() => { result.current.addSkill('Triage') })
    expect(result.current.skills).toEqual(['Triage'])
  })

  it('removeSkill filters out exactly that value and PATCHes the shrunk array', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancySkills(vacancy({ skills: ['Triage', 'Wondzorg'] }), onUpdate))
    act(() => { result.current.removeSkill('Triage') })
    expect(result.current.skills).toEqual(['Wondzorg'])
    expect(onUpdate).toHaveBeenCalledWith('v1', { skills: ['Wondzorg'] })
  })

  // VACANCY-SKILLS-PARITY-1: rename IN PLACE (same array position), never remove+re-add.
  it('editSkill renames a skill at its own index and PATCHes the updated array', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancySkills(vacancy({ skills: ['Triage', 'Wondzorg'] }), onUpdate))
    act(() => { result.current.editSkill(1, 'Wondverzorging') })
    expect(result.current.skills).toEqual(['Triage', 'Wondverzorging'])
    expect(onUpdate).toHaveBeenCalledWith('v1', { skills: ['Triage', 'Wondverzorging'] })
  })

  it('editSkill ignores a rename that collides with a different existing skill', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useVacancySkills(vacancy({ skills: ['Triage', 'Wondzorg'] }), onUpdate))
    act(() => { result.current.editSkill(1, 'Triage') })
    expect(result.current.skills).toEqual(['Triage', 'Wondzorg'])
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('seeds from the vacancy on mount and normalises object-shaped legacy entries', () => {
    const legacy = [{ name: 'Triage' }, 'Wondzorg', { label: 'BIG-registratie' }] as unknown as string[]
    const { result } = renderHook(() => useVacancySkills(vacancy({ skills: legacy })))
    expect(result.current.skills).toEqual(['Triage', 'Wondzorg', 'BIG-registratie'])
  })
})

describe('useVacancySkills · reseeds on entity switch', () => {
  it('never leaks the previous vacancy\'s skills into a newly opened one', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useVacancySkills(v),
      { initialProps: { v: vacancy({ id: 'v1', skills: ['Triage'] }) } },
    )
    expect(result.current.skills).toEqual(['Triage'])
    rerender({ v: vacancy({ id: 'v2', skills: ['Wondzorg'] }) })
    expect(result.current.skills).toEqual(['Wondzorg'])
  })
})
