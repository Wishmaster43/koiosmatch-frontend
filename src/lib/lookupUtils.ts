/**
 * lookupUtils — shared helpers for the tenant-configurable lookup hooks
 * (useFunctions, useGenders, useOpportunityStages, …). One place to extract a
 * flat name list or normalise option rows, so the per-lookup hooks stay tiny and
 * the parsing rules don't drift across files.
 */
import type { AxiosResponse } from 'axios'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

type Named = { name?: string; label?: string; value?: string }

/** Pull a flat string list from a lookup endpoint (rows are string | {name|label|value}). */
export function lookupNames(res: AxiosResponse): string[] {
  const raw = (unwrapList(res).rows) as unknown[]
  return raw
    .map(x => (typeof x === 'string' ? x : ((x as Named).name ?? (x as Named).label ?? (x as Named).value)))
    .filter((v): v is string => Boolean(v))
}

/** Normalise option rows → {id?, value, label, color}; drop inactive, sort by order. */
// eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
export function normalizeOptions(raw: unknown, fallback: LookupOption[] | null = null, defaultColor = '#9CA3AF'): LookupOption[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return fallback
  const order = (it: Record<string, unknown>) => Number(it.order ?? it.sort_order ?? it.position ?? 0)
  return (raw as Record<string, unknown>[])
    .filter(it => it.active !== false)
    .sort((a, b) => order(a) - order(b))
    .map(it => ({
      id: it.id,
      value: String(it.value ?? it.id ?? ''),
      label: String(it.label ?? it.name ?? it.value ?? ''),
      color: (it.color as string) ?? defaultColor,
      // Pass terminal-stage flags through when the lookup carries them (e.g. the
      // opportunity pipeline's won/lost stages); absent on lookups without them.
      ...(it.is_won != null ? { isWon: Boolean(it.is_won) } : {}),
      ...(it.is_lost != null ? { isLost: Boolean(it.is_lost) } : {}),
    }))
}

/**
 * sortActiveRows — the filter+sort step shared by the three multi-list lookup
 * contexts (LookupsContext/VacancyLookupsContext/TaskLookupsContext, C-13). Each
 * context still maps rows to its own shape (different flags per axis), but the
 * "drop inactive, sort by order/sort_order" rule now lives in one place instead
 * of three near-identical copies.
 */
export function sortActiveRows(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return []
  return (raw as Record<string, unknown>[])
    .filter(it => it.active !== false)
    .sort((a, b) => (Number(a.order ?? a.sort_order ?? 0)) - (Number(b.order ?? b.sort_order ?? 0)))
}

/**
 * makeMetaResolver — the "value → item, with a neutral fallback" lookup shared by
 * all multi-list lookup contexts, so the UI never crashes on an unknown value.
 * `fallbackColor` and `extra` let each axis keep its exact prior fallback shape
 * (e.g. task statuses fell back with `is_done: false`).
 */
export function makeMetaResolver<T extends { value: string; label: string; color?: string }>(
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
  list: T[], fallbackColor = '#9CA3AF', extra: Partial<T> = {},
) {
  return (v?: string | null): T =>
    list.find(i => i.value === v) ?? ({ value: v ?? '', label: v ?? '', color: fallbackColor, ...extra } as T)
}

/**
 * Map stored/seed filter values onto the tenant lookup's CANONICAL option values
 * (case/trim-tolerant, matches value OR label). Fixes the "1 geselecteerd maar
 * geen vinkje" class of bug (Danny 23-07): a preselection computed against the
 * seed lookup ('open') stops matching once the API lookup arrives ('Open') —
 * the count sees one value, the checklist another. Unmatched values pass
 * through so vocabulary drift never silently drops a filter; result is deduped.
 */
export function canonicalizeToOptions(values: string[], options: Array<{ value: string; label?: string }>): string[] {
  const byKey = new Map<string, string>()
  options.forEach(o => {
    byKey.set(o.value.trim().toLowerCase(), o.value)
    if (o.label) byKey.set(String(o.label).trim().toLowerCase(), o.value)
  })
  const out: string[] = []
  values.forEach(v => {
    const canon = byKey.get(String(v).trim().toLowerCase()) ?? v
    if (!out.includes(canon)) out.push(canon)
  })
  return out
}
