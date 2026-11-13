/**
 * labelOrRaw — translated label when the key exists in the namespace, the server's
 * own text when it does not (open-ended values); never a bare key path.
 */
import { describe, it, expect, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { labelOrRaw } from './labelOrRaw'

describe('labelOrRaw', () => {
  // The stub echoes the namespace t() was given, so a wrong-namespace resolution would show.
  const t = ((k: string, o?: { ns?: string }) => `T:${o?.ns}:${k}`) as unknown as TFunction

  it('translates when the key exists (checked AND resolved in the analytics namespace)', () => {
    const exists = vi.fn().mockReturnValue(true)
    expect(labelOrRaw(t, { exists }, 'a.b', 'raw')).toBe('T:analytics:a.b')
    expect(exists).toHaveBeenCalledWith('a.b', { ns: 'analytics' })
  })

  it('passes an explicit namespace to both the existence check and t(), whatever t is bound to', () => {
    const exists = vi.fn().mockReturnValue(true)
    expect(labelOrRaw(t, { exists }, 'x.y', 'raw', 'settings')).toBe('T:settings:x.y')
    expect(exists).toHaveBeenCalledWith('x.y', { ns: 'settings' })
  })

  it('falls back to the raw server text when the key is missing', () => {
    expect(labelOrRaw(t, { exists: () => false }, 'a.b', 'raw')).toBe('raw')
  })

  it('falls back to the raw text when react-i18next hands an empty i18n object (no instance in a test tree)', () => {
    expect(labelOrRaw(t, {} as unknown as { exists: () => boolean }, 'a.b', 'raw')).toBe('raw')
  })
})
