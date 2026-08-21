/**
 * useVacancySkills — the vacancy's required-skills list, extracted out of
 * useVacancyDetailsForm because the list itself moved from the Eisen card
 * onto the Vacaturetekst tab (VACATURES 4, DRILLDOWN-VOLGORDE-CANON 21-08):
 * the required-skills list now sits directly under the vacancy text, not
 * under the Requirements card. Persistence is now ALWAYS immediate — the old
 * "ride along with the Eisen Save while its pencil is open" coupling only
 * existed because the list lived inside that card; now that it lives on a
 * different tab entirely, there is no sibling pencil to ride along with.
 */
import { useEffect, useState } from 'react'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

// Normalise a skill entry (string, or an object shape some seeds still carry) to plain text.
export const skillStr = (s: unknown): string => (typeof s === 'string' ? s : ((s as { name?: string; label?: string })?.name ?? (s as { label?: string })?.label ?? ''))

export function useVacancySkills(v: VacancyDetail, onUpdate?: UpdateFn) {
  const [skills, setSkills] = useState<string[]>(() => (v.skills ?? []).map(skillStr).filter(Boolean))
  // Reseed when the entity itself changes — switching to a different vacancy
  // must never leak the previous one's skill list into the new draft.
  useEffect(() => {
    setSkills((v.skills ?? []).map(skillStr).filter(Boolean))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed on entity switch only, never on every skills-array identity change
  }, [v.id])

  // Persist is always immediate now — no sibling pencil to ride along with.
  const persist = (next: string[]) => { setSkills(next); onUpdate?.(v.id, { skills: next }) }
  const addSkill = (name: string) => { const sk = name.trim(); if (sk && !skills.includes(sk)) persist([...skills, sk]) }
  // Rename a skill IN PLACE (same list position) — a plain string[] field has
  // no id to PATCH individually against, so a rename replaces that index.
  const editSkill = (i: number, name: string) => {
    const sk = name.trim()
    if (!sk || skills.some((s, idx) => idx !== i && s === sk)) return
    persist(skills.map((s, idx) => (idx === i ? sk : s)))
  }
  const removeSkill = (s: string) => persist(skills.filter(x => x !== s))

  return { skills, addSkill, editSkill, removeSkill }
}
