/**
 * Every notification type the backend catalogue (lang/nl/notifications.php) can send has its
 * title/body in all seven FE locales, so the bell never falls back to a bureau-language literal
 * (ONIX J-007). The key list is a committed snapshot because the FE CI cannot read the api repo.
 */
import { describe, it, expect } from 'vitest'
import snapshot from './notificationsCatalogueKeys.json'

const LANGS = ['nl', 'en', 'de', 'fr', 'es', 'it', 'pt'] as const
const mods = import.meta.glob('./locales/*/notifications.json', { eager: true, import: 'default' }) as Record<string, unknown>

// A leaf is present as a string, or as a key_one + key_other plural pair.
const has = (root: unknown, key: string): boolean => {
  let cur: unknown = root
  const parts = key.split('.')
  for (const [i, part] of parts.entries()) {
    const isLast = i === parts.length - 1
    if (!cur || typeof cur !== 'object') return false
    if (!(part in (cur as object))) {
      if (!isLast) return false
      const o = cur as Record<string, unknown>
      return typeof o[`${part}_one`] === 'string' && typeof o[`${part}_other`] === 'string'
    }
    cur = (cur as Record<string, unknown>)[part]
  }
  return typeof cur === 'string'
}

describe('notification catalogue parity', () => {
  it.each(LANGS)('%s carries every backend leaf key', l => {
    const root = mods[`./locales/${l}/notifications.json`]
    const missing = (snapshot as string[]).filter(k => !has(root, k))
    expect(missing).toEqual([])
  })
})
