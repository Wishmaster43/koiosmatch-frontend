/**
 * useMatchStopReasons — the terminate picker must never offer a platform-written
 * (is_system) reason: POST /matches/{id}/terminate refuses it with 422.
 */
import { describe, it, expect } from 'vitest'
import type { AxiosResponse } from 'axios'
import { mapUserStopReasons } from './useMatchStopReasons'

describe('mapUserStopReasons', () => {
  it('drops is_system rows and keeps the rest', () => {
    const res = { data: { data: [
      { value: 'sick', label: 'Ziek' },
      { value: 'auto', label: 'Auto', is_system: true },
      { value: 'other', label: 'Anders', is_system: false },
    ] } } as unknown as AxiosResponse
    expect(mapUserStopReasons(res)?.map(r => r.value)).toEqual(['sick', 'other'])
  })
})
