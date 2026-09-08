/**
 * buildKpiSpecs — the one builder behind every report's nine-card KPI strip.
 * Each report used to copy the same loop: walk its label-key map, read the server
 * value, pick a colour when the count is non-zero, wire the per-KPI drill. The two
 * idioms in the codebase differ only in how the record is keyed (label-key tail
 * versus server key), whether the click needs a value, and per-report value/sub
 * formatting — all of which arrive here as options (DRY-1 O5 round 8).
 */
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import type { KpiSpec } from '@/components/insights/InsightsRow'

export interface BuildKpiSpecsOpts {
  // Server KPI values by server key (the `kpis[]` envelope, mapped once by the caller).
  kpis: Map<string, number | null | undefined>
  // Server key → i18n label key, in the order the cards render.
  labelKeys: Record<string, string>
  // Semantic colour per server key; applied only when the value is present and non-zero (§4).
  colors: Partial<Record<string, string>>
  t: TFunction
  // The report's own drill opener; may return undefined when the report has no drill for a key.
  openKpiDrill: (serverKey: string, label: string, value: string | number) => (() => void) | undefined
  // Per-report value formatting; default: the raw number, or the house dash when NULL (STATS-HONEST-1).
  valueFor?: (serverKey: string, raw: number | null | undefined, has: boolean) => string | number
  // Per-report caption (unit text, compare metric, threshold caption).
  subFor?: (serverKey: string, raw: number | null | undefined, has: boolean) => ReactNode | undefined
  // 'camel' keys the record by the label key's tail (applications/whatsapp idiom);
  // 'server' keys it by the server key and marks the open drill's card active.
  keyBy?: 'camel' | 'server'
  // The kpi of the currently open drill (server-keyed reports): that card renders active.
  activeKey?: string
  // Wire the click only when the server sent a value (server-keyed reports).
  clickOnlyWhenHas?: boolean
}

// Builds the ordered card record; the value stays a NUMBER when the report passes one
// through, so KpiCard keeps formatting it on the active locale (GETALLEN-1).
export function buildKpiSpecs(o: BuildKpiSpecsOpts): Record<string, KpiSpec> {
  return Object.fromEntries(
    Object.entries(o.labelKeys).map(([serverKey, labelKey]) => {
      const key = o.keyBy === 'server' ? serverKey : labelKey.split('.').pop()!
      const raw = o.kpis.get(serverKey)
      const has = raw != null
      const label = o.t(labelKey)
      const value: string | number = o.valueFor ? o.valueFor(serverKey, raw, has) : has ? (raw as number) : '—'
      const sub = o.subFor?.(serverKey, raw, has)
      const color = has && raw !== 0 ? o.colors[serverKey] : undefined
      const onClick = o.clickOnlyWhenHas && !has ? undefined : o.openKpiDrill(serverKey, label, value)
      const spec: KpiSpec = {
        key, label, value, sub, color,
        ...(o.keyBy === 'server' ? { active: o.activeKey === serverKey } : {}),
        ...(onClick ? { onClick } : {}),
      }
      return [key, spec]
    }),
  )
}
