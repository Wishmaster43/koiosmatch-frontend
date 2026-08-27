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

/**
 * KOIOS-MODEL-VOCAB-1 (Danny 27-08): GET /ai/koios/settings now serves
 * `models.options[]` — {id, label, hint, cost_rank} — the tenant-facing label/hint
 * ALREADY resolved server-side (AI-MODELS-1: friendly labels + a relative cost
 * hint, never a number). `id` is a flavour key (snel/slim/max), not a raw vendor
 * model id. Every picker reads THIS as the primary vocabulary; the tier substring
 * match above stays only as a fallback for an id the server didn't list (a legacy
 * raw vendor id such as a chat reply's `usage.model`).
 */
export interface KoiosModelOption {
  id: string
  label: string
  hint?: string | null
  cost_rank?: number
}

// Minimal translate signature — mirrors types/koios.ts' TFn without importing it
// (keeps this a dependency-free lib module).
type TranslateFn = (key: string, opts?: Record<string, unknown>) => string

// The server option for one model/flavour id, or null when the server didn't list it.
export function findModelOption(id?: string | null, options?: KoiosModelOption[] | null): KoiosModelOption | null {
  if (!id || !Array.isArray(options)) return null
  return options.find((o) => o.id === id) ?? null
}

// KOIOS-MODEL-VOCAB-1 I18N FIX (27-08): the server's `label`/`hint` for the three
// KNOWN flavour keys are Dutch-only PLATFORM config (config/koios_ai.php), not
// translated data — rendering them raw was an §5 i18n regression for non-NL
// tenants. For a known flavour the SHIPPED `models.tier.*`/`models.tierHint.*`
// translations win instead; the server option stays the fallback vocabulary only
// for an id the server lists that is NOT one of these three (a future flavour or
// a legacy raw vendor id).
const FLAVOR_TIER_MAP: Record<string, ModelTierKey> = { snel: 'fast', slim: 'smart', max: 'max' }

// Resolve a model/flavour id to its display label: a known flavour's translated
// tier label first, then the server's own label, then the shared tier substring
// match (for a legacy raw vendor id), and finally the raw id as an honest last resort.
export function resolveModelLabel(id: string | null | undefined, options: KoiosModelOption[] | null | undefined, t: TranslateFn): string {
  const flavorTier = id ? FLAVOR_TIER_MAP[id] : undefined
  if (flavorTier) return t(`models.tier.${flavorTier}`, { ns: 'koios' })
  const option = findModelOption(id, options)
  if (option) return option.label
  const key = tierKeyForModel(id)
  return key ? t(`models.tier.${key}`, { ns: 'koios' }) : (id ?? '')
}

// Resolve a model/flavour id to its display hint: a known flavour's translated
// `models.tierHint.<flavor>` key first, falling back to the server's own hint as
// the i18next `defaultValue` (so an un-translated flavour still shows something),
// then the server hint for an unlisted id, then null.
export function resolveModelHint(id: string | null | undefined, options: KoiosModelOption[] | null | undefined, t: TranslateFn): string | null {
  const option = findModelOption(id, options)
  const flavorTier = id ? FLAVOR_TIER_MAP[id] : undefined
  if (flavorTier) {
    return t(`models.tierHint.${id}`, { ns: 'koios', defaultValue: option?.hint ?? t(`models.tierDesc.${flavorTier}`, { ns: 'koios' }) })
  }
  return option?.hint ?? null
}
