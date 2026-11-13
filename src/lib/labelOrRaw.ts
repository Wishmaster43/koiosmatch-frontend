/**
 * labelOrRaw — translate a per-value label key, or fall back to the server's own
 * text when no locale key exists for that (open-ended) value. Replaces the
 * `t(key, { defaultValue })` pattern: the fallback is DATA from the server, never
 * a literal second copy of the translation.
 */
import type { TFunction } from 'i18next'

// The one i18n member used here, kept structural so tests can pass a plain stub; exported so a
// helper that receives `t` as a parameter can take the checker next to it (never `@/i18n` itself).
export interface KeyChecker { exists: (key: string, options?: { ns?: string }) => boolean }

// Returns the translated label when the key exists in `ns`, else the raw fallback text. The `ns`
// goes to t() as well, so the caller's t may be bound to any namespace. An uninitialised
// react-i18next (a test tree without an instance) hands an EMPTY i18n object: the fallback is then
// the honest output, exactly what the old `t(key, { defaultValue })` path showed there.
export function labelOrRaw(t: TFunction, i18n: KeyChecker, key: string, fallback: string, ns = 'analytics'): string {
  return typeof i18n?.exists === 'function' && i18n.exists(key, { ns }) ? t(key, { ns }) : fallback
}
