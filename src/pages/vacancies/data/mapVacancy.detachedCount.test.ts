/**
 * mapVacancy · ONTKOPPEL-TELLER-1 — the detail-only, server-computed count of this
 * vacancy's applications CURRENTLY detached (soft-deleted, not restored). Whole-history,
 * never the screen's active filter window; hidden by the badge at 0/undefined.
 */
import { describe, it, expect } from 'vitest'
import { mapVacancy } from './mapVacancy'
import type { ApiVacancy } from '@/types/vacancy'

describe('mapVacancy · detachedCount', () => {
  it('reads detached_count from the API payload', () => {
    const v = mapVacancy({ id: 1, title: 'Verpleegkundige', detached_count: 1 } as ApiVacancy)
    expect(v.detachedCount).toBe(1)
  })

  it('leaves detachedCount undefined when the field is absent, never a fabricated 0', () => {
    const v = mapVacancy({ id: 1, title: 'Verpleegkundige' } as ApiVacancy)
    expect(v.detachedCount).toBeUndefined()
  })
})
