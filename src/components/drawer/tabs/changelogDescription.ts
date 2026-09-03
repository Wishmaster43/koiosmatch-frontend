/**
 * CHANGELOG-DESC-I18N-1: the backend now logs some audit descriptions as stable
 * KEYS ("lookup.reordered", "match.created") instead of a Dutch literal — this
 * pure helper turns a key-shaped description into its translation, and leaves
 * everything else (legacy Dutch literals not yet migrated) exactly as it is.
 */
import type { TFunction } from 'i18next'

// A "key shape": lowercase dotted segments, e.g. "lookup.reordered" — at least
// one dot, so a plain sentence/legacy literal never matches by accident.
const KEY_SHAPE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/

// Sentinel that a real translation can never equal, so we can tell "missing key"
// apart from "translation happens to be this string".
const MISSING = '__changelog_description_missing__'

// Translate a changelog description key when it exists; otherwise return the
// input unchanged (raw legacy literal, or an unknown key-shaped string).
export function describeChangelog(description: string | null | undefined, t: TFunction): string | null | undefined {
  if (!description || !KEY_SHAPE.test(description)) return description
  // Explicit 'common:' namespace prefix: the caller's own useTranslation(namespace)
  // (e.g. "candidates") must not shadow this — the keys live in common.json only.
  // NOTE: common.json already has a top-level bare string "changelog" (the tab
  // title, ChangelogPopover.tsx) — nesting under it would break that key, so
  // these live under the sibling "changelogDescriptions" object instead.
  const translated = t(`common:changelogDescriptions.${description}`, { defaultValue: MISSING })
  return translated === MISSING ? description : translated
}
