/**
 * koiosModelTiers — model id → tenant-facing "stand" tier (Snel/Slim/Max), the ONE
 * place this substring match lives (Danny 05-08, K-37: the floating Koios panel
 * showed the raw vendor model id — e.g. "claude-haiku-4-5" — instead of the
 * tenant's own stand name; the Settings → Koios AI model picker had already solved
 * this with its own local `tierFor()`). This file promotes that matching logic to
 * a shared `lib/` helper so KoiosModelPicker/KoiosUsage reuse the EXACT same
 * options source instead of a second hand-maintained id→tier map (CLAUDE.md §11).
 *
 * Mirrors the whitelist in `config/koios_ai.php` (backend, read-only reference):
 * haiku → fast, sonnet → smart, opus/fable → max. An id outside this whitelist
 * resolves to `null` — callers show the raw id as an honest fallback rather than
 * invent a label for a model the tenant never picked from Settings.
 *
 * Display strings for each tier live in i18n namespace 'koios' →
 * `models.tier.<key>` / `models.tierDesc.<key>` (already shipped in all five
 * locales for the Settings screen) — this file only resolves the KEY, never a
 * display string, so every consumer stays one `t(key, { ns: 'koios' })` away from
 * full translation with zero new keys.
 */
export type ModelTierKey = 'fast' | 'smart' | 'max'

// Substring match against the raw model id — never an exact-id map, so a future
// dated model id (e.g. a new Haiku release) still resolves to its tier.
export function tierKeyForModel(id?: string | null): ModelTierKey | null {
  if (!id) return null
  if (id.includes('haiku')) return 'fast'
  if (id.includes('sonnet')) return 'smart'
  if (id.includes('opus') || id.includes('fable')) return 'max'
  return null
}
