/**
 * settingsSearchIndex — the index + matcher behind the settings ⌘K palette.
 *
 * Why it exists (bug SETTINGS-SEARCH-1): the palette filtered with a raw
 * `label.toLowerCase().includes(query)` over the translated nav/group labels
 * only. Typing "email" returned "no settings found" because every Dutch label
 * spells it "E-mail" — the hyphen killed the substring match (and in English the
 * mirror image happened for "e-mail"). Matching now runs on a NORMALISED form
 * (lowercase, diacritics stripped, non-alphanumerics removed), so "e-mail",
 * "E‑Mail" and "email" are literally the same word. On top of that every entry
 * carries translated SYNONYMS — per group and per token of its registry id — so
 * a recruiter's own words ("mail", "bericht", "sjabloon") find the screen.
 *
 * Kept deliberately dependency-free: the index is ~150 entries, so a normalised
 * substring scan per keystroke is far cheaper than any fuzzy-search library.
 */
import type { ElementType } from 'react'

/** A settings sub-tab as declared in the nav registry. */
export interface SettingsNavItem {
  id: string
  icon?: ElementType
}

/** A settings category (left menu) holding its sub-tabs. */
export interface SettingsNavGroup {
  key: string
  icon?: ElementType
  items: SettingsNavItem[]
}

/** One searchable row: what we show, plus the normalised text we match on. */
export interface SettingsSearchEntry {
  groupKey: string
  id: string
  icon?: ElementType
  label: string
  group: string
  /** Normalised label / group label — carry the strongest ranking weight. */
  normalizedLabel: string
  normalizedGroup: string
  /** Normalised id tokens and translated synonyms — the "recruiter's words" layer. */
  terms: string[]
}

/** Minimal shape of i18next's `t` we rely on — keeps this module test-friendly. */
export type SettingsTranslate = (key: string, options?: { defaultValue?: string }) => string

/**
 * Fold text to its comparable form: lowercase, diacritics removed, every
 * non-alphanumeric dropped. This is what makes "E-mail" === "email" and
 * "Rijbewijs/rijbewijs" === "rijbewijs" on BOTH sides of the comparison.
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** Collect a phrase as one normalised run plus its individual words, skipping blanks. */
function collectTerms(text: string, into: string[]): void {
  if (!text) return
  const whole = normalizeSearchText(text)
  if (whole) into.push(whole)
  for (const word of text.split(/\s+/)) {
    const normalized = normalizeSearchText(word)
    if (normalized && normalized !== whole) into.push(normalized)
  }
}

/**
 * Build the searchable index from the already role-/module-filtered registry.
 * Per entry we index: the translated tab label, the translated group label, the
 * raw registry id (so 'email_klanten' is findable as typed), the group synonyms
 * and the synonyms of every id token — all from the `settingsSearch` namespace,
 * which exists in all five shipped locales (§5, no silent Dutch fallback).
 */
export function buildSettingsSearchEntries(
  groups: SettingsNavGroup[],
  t: SettingsTranslate,
): SettingsSearchEntry[] {
  return groups.flatMap(group => {
    // Group-level synonyms are inherited by every sub-tab inside that group.
    const groupLabel = t(`groups.${group.key}`)
    const groupTerms: string[] = []
    collectTerms(group.key.replace(/_/g, ' '), groupTerms)
    collectTerms(t(`settingsSearch:groups.${group.key}`, { defaultValue: '' }), groupTerms)

    return group.items.map(item => {
      const label = t(`nav.${item.id}`)
      const terms = [...groupTerms]
      // The id itself is searchable, and each of its tokens pulls in its own
      // synonym list ("email" → mail/bericht/sjabloon, "klanten" → opdrachtgevers).
      collectTerms(item.id.replace(/_/g, ' '), terms)
      for (const token of item.id.split('_')) {
        collectTerms(t(`settingsSearch:terms.${token}`, { defaultValue: '' }), terms)
      }
      return {
        groupKey: group.key,
        id: item.id,
        icon: item.icon,
        label,
        group: groupLabel,
        normalizedLabel: normalizeSearchText(label),
        normalizedGroup: normalizeSearchText(groupLabel),
        terms,
      }
    })
  })
}

/** Rank a hit: label beats group label beats synonym, prefix beats mid-word. */
function scoreEntry(entry: SettingsSearchEntry, query: string): number {
  if (entry.normalizedLabel.startsWith(query)) return 4
  if (entry.normalizedLabel.includes(query)) return 3
  if (entry.normalizedGroup.includes(query)) return 2
  return entry.terms.some(term => term.includes(query)) ? 1 : 0
}

/**
 * Filter + rank the index for a query. An empty query keeps the full registry
 * order; Array.prototype.sort is stable, so equally-scored hits stay in that
 * order too (predictable list, no jitter while typing).
 */
export function filterSettingsSearchEntries(
  entries: SettingsSearchEntry[],
  query: string,
): SettingsSearchEntry[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return entries
  return entries
    .map(entry => ({ entry, score: scoreEntry(entry, normalizedQuery) }))
    .filter(hit => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(hit => hit.entry)
}
