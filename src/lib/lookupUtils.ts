/**
 * lookupUtils — shared helpers for the tenant-configurable lookup hooks
 * (useFunctions, useGenders, useOpportunityStages, …). One place to extract a
 * flat name list or normalise option rows, so the per-lookup hooks stay tiny and
 * the parsing rules don't drift across files.
 */
import type { AxiosResponse } from 'axios'
import type { LookupOption } from '@/types/common'

type Named = { name?: string; label?: string; value?: string }

/** Pull a flat string list from a lookup endpoint (rows are string | {name|label|value}). */
export function lookupNames(res: AxiosResponse): string[] {
  const raw = (res?.data?.data ?? res?.data ?? []) as unknown[]
  return raw
    .map(x => (typeof x === 'string' ? x : ((x as Named).name ?? (x as Named).label ?? (x as Named).value)))
    .filter((v): v is string => Boolean(v))
}

/** Normalise option rows → {id?, value, label, color}; drop inactive, sort by order. */
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
    }))
}
