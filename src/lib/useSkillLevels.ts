/**
 * useSkillLevels — tenant-configurable skill proficiency levels, mirroring the
 * language-levels lookup so the skill "niveau" is a dropdown (not free text).
 * Fed by GET /skill-levels once the backend + Settings section land (SKILL-LVL-1);
 * a seed fallback drives the dropdown until then.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'

// Seed defaults — labels tenant-facing, normally from the API.
export const DEFAULT_SKILL_LEVELS = ['Basis', 'Gevorderd', 'Expert']

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapSkillLevels = (res: AxiosResponse): string[] | null => {
  const rows = (unwrapList(res).rows) as Array<string | { name?: string; label?: string; value?: string }>
  const names = rows.map(x => typeof x === 'string' ? x : (x.name ?? x.label ?? x.value ?? '')).filter(Boolean) as string[]
  return names.length ? names : null
}

export function useSkillLevels() {
  // The endpoint now exists (item 11) — a real 404 should surface in the dev log again.
  const { data: levels } = useCachedLookup('/skill-levels', mapSkillLevels, DEFAULT_SKILL_LEVELS)
  return { levels }
}
