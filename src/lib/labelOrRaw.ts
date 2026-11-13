/**
 * labelOrRaw — translate a per-value label key, or fall back to the server's own
 * text when no locale key exists for that (open-ended) value. Replaces the
 * `t(key, { defaultValue })` pattern: the fallback is DATA from the server, never
 * a literal second copy of the translation.
 */
import type { TFunction } from 'i18next'

// The one i18n member used here, kept structural so tests can pass a plain stub.
interface KeyChecker { exists: (key: string, options?: { ns?: string }) => boolean }

// Returns the translated label when the key exists in the active namespace, else the raw fallback text.
export function labelOrRaw(t: TFunction, i18n: KeyChecker, key: string, fallback: string, ns = 'analytics'): string {
  return i18n.exists(key, { ns }) ? t(key) : fallback
}
