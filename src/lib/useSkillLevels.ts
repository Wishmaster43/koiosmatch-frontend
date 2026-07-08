/**
 * useSkillLevels — tenant-configurable skill proficiency levels, mirroring the
 * language-levels lookup so the skill "niveau" is a dropdown (not free text).
 * Fed by GET /skill-levels once the backend + Settings section land (SKILL-LVL-1);
 * a seed fallback drives the dropdown until then.
 */
import { useState, useEffect } from 'react'
import api from './api'

// Seed defaults — labels tenant-facing, normally from the API.
export const DEFAULT_SKILL_LEVELS = ['Basis', 'Gevorderd', 'Expert']

export function useSkillLevels() {
  const [levels, setLevels] = useState<string[]>(DEFAULT_SKILL_LEVELS)

  // Load the tenant lookup once; keep the seed while the endpoint is missing.
  useEffect(() => {
    let alive = true
    api.get('/skill-levels', { quiet404: true })
      .then(r => {
        const rows = (r.data?.data ?? r.data ?? []) as Array<string | { name?: string; label?: string; value?: string }>
        const names = rows.map(x => typeof x === 'string' ? x : (x.name ?? x.label ?? x.value ?? '')).filter(Boolean)
        if (alive && names.length) setLevels(names as string[])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return { levels }
}
