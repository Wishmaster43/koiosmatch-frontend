/**
 * Locale-wiring guard: every locale FOLDER on disk must be wired into
 * LOCALE_BY_LANG (Intl formatting) and into every auth.json's languageNames
 * (the picker's endonym) — a folder that loads but isn't wired is a silent
 * half-integration (§5: i18n is all-or-nothing).
 *
 * Loads the JSON via Vite's import.meta.glob (no node fs, mirrors
 * localeParity.test.ts) so tsc and vitest agree.
 */
import { describe, it, expect } from 'vitest'
import { LOCALE_BY_LANG } from './index'

type Json = { [k: string]: unknown }

// Every locale JSON, keyed by its path './locales/<loc>/<file>.json' — the
// set of distinct <loc> segments is the folder list this guard checks.
const modules = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' }) as Record<string, Json>
const folders = [...new Set(Object.keys(modules).map(p => p.match(/\.\/locales\/([^/]+)\//)?.[1]).filter((f): f is string => !!f))]

describe('locale wiring — every locale folder is fully registered', () => {
  it('LOCALE_BY_LANG has an entry for every locale folder', () => {
    const missing = folders.filter(f => !LOCALE_BY_LANG[f])
    expect(missing, `LOCALE_BY_LANG is missing: ${missing.join(', ')}`).toEqual([])
  })

  it('every auth.json languageNames covers every locale folder', () => {
    for (const loc of folders) {
      const auth = modules[`./locales/${loc}/auth.json`] as { languageNames?: Record<string, string> } | undefined
      const names = auth?.languageNames ?? {}
      const missing = folders.filter(f => !names[f])
      expect(missing, `${loc}/auth.json languageNames is missing: ${missing.join(', ')}`).toEqual([])
    }
  })
})
