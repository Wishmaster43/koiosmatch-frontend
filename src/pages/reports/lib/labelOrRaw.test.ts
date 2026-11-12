/**
 * labelOrRaw — translated label when the key exists in the namespace, the server's
 * own text when it does not (open-ended values); never a bare key path.
 */
import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { labelOrRaw } from './labelOrRaw'

describe('labelOrRaw', () => {
  const t = ((k: string) => `T:${k}`) as unknown as TFunction

  it('translates when the key exists (checked in the analytics namespace)', () => {
    const exists = vi.fn().mockReturnValue(true)
    expect(labelOrRaw(t, { exists }, 'a.b', 'raw')).toBe('T:a.b')
    expect(exists).toHaveBeenCalledWith('a.b', { ns: 'analytics' })
  })

  it('falls back to the raw server text when the key is missing', () => {
    expect(labelOrRaw(t, { exists: () => false }, 'a.b', 'raw')).toBe('raw')
  })
})
