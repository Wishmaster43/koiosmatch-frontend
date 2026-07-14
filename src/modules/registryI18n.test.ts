/**
 * Registry i18n coverage guard (§5): every user-facing `placeholder` / `hint` /
 * `help` string in the module registry must have a workflows.json key in every
 * shipped locale (fieldPlaceholders.* / fieldHints.*), unless it is explicitly
 * allow-listed as language-neutral (numbers, URLs, raw tokens, code samples).
 * Adding a new Dutch registry string without its ×5 keys fails this test.
 */
import { describe, it, expect } from 'vitest'
import { MODULE_SCHEMAS } from '@/modules/index'
import { i18nKey } from '@/components/layout/workflow/moduleI18n'

// Every shipped locale's workflows.json, loaded like localeParity.test.ts does.
const modules = import.meta.glob('../i18n/locales/*/workflows.json', { eager: true, import: 'default' }) as Record<string, {
  fieldPlaceholders?: Record<string, string>
  fieldHints?: Record<string, string>
}>
const LOCS = ['nl', 'en', 'de', 'fr', 'es']

// Language-neutral registry literals — identical in every language, so they
// deliberately have NO key and render via the defaultValue fallback.
const NEUTRAL = new Set([
  '0', '1', '5', '10', '24', '30', '35', '50', '100', '500', '10000',
  'nl', 'tr', 'status', 'available_again_date', 'shifts_offered',
  '{"key": "value"}', '<html>...</html>', '<table>...</table>', '(\\d+)',
  'https://api.intus.example/candidates', 'https://api.intus.example/shifts',
  '{{trigger.session_id}}', 'flex@yesway.nu',
  '{{1.bedrag}}', '{{1.inhoud}}', '{{1.naam}}', '{{1.waarde}}',
])

// Collect every placeholder/hint/help string from the registry schemas.
const wanted: Array<{ bucket: 'fieldPlaceholders' | 'fieldHints'; src: string }> = []
for (const schema of Object.values(MODULE_SCHEMAS)) {
  for (const field of (schema ?? []) as Array<Record<string, unknown>>) {
    const ph = field.placeholder
    if (typeof ph === 'string' && ph && !NEUTRAL.has(ph)) wanted.push({ bucket: 'fieldPlaceholders', src: ph })
    for (const k of ['hint', 'help'] as const) {
      const v = field[k]
      if (typeof v === 'string' && v && !NEUTRAL.has(v)) wanted.push({ bucket: 'fieldHints', src: v })
    }
  }
}

describe('module registry placeholder/hint i18n coverage', () => {
  it('found registry strings to check (sanity)', () => {
    expect(wanted.length).toBeGreaterThan(50)
  })

  for (const loc of LOCS) {
    it(`${loc}/workflows.json covers every registry placeholder/hint`, () => {
      const file = Object.entries(modules).find(([p]) => p.includes(`/${loc}/`))?.[1]
      expect(file, `${loc}/workflows.json not found`).toBeTruthy()
      const missing = wanted
        .filter(({ bucket, src }) => (file?.[bucket] ?? {})[i18nKey(src)] == null)
        .map(({ bucket, src }) => `${bucket}: ${JSON.stringify(src)}`)
      expect([...new Set(missing)], `missing in ${loc}: ${[...new Set(missing)].join(' | ')}`).toEqual([])
    })
  }
})
