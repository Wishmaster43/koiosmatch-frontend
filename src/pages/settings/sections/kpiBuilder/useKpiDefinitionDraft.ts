/**
 * useKpiDefinitionDraft — local edit state for the KPI-definition form (add or
 * edit). Keeps the unit following the selected metric's own default until the
 * tenant overrides it for that metric, resets `dimension_value` whenever the
 * dimension changes, and hands the panel a create body (entity injected by the
 * caller, `sort_order`/`computed` never sent) or a minimal patch body containing
 * only the keys that actually changed (§10 PATCH: absent field = unchanged).
 */
import { useMemo, useState } from 'react'
import type { KpiDefinition, KpiComparison, KpiSurface, KpiUnit, KpiEntityRegistry } from './kpiDefinitionsApi'

export interface KpiDefinitionDraft {
  metric_key: string
  dimension: string
  dimension_value: string | null
  label: string
  unit: KpiUnit | ''
  comparison: KpiComparison
  target_value: number | null
  warn_value: number | null
  surfaces: KpiSurface[]
  active: boolean
}

// A fresh draft for "add" — 'all' dimension, no target/warn, visible on the report by default.
export function emptyDraft(): KpiDefinitionDraft {
  return {
    metric_key: '', dimension: 'all', dimension_value: null, label: '', unit: '',
    comparison: 'none', target_value: null, warn_value: null, surfaces: ['report'], active: true,
  }
}

// The editing row translated into draft shape (label/target/warn null → their edit-field defaults).
function draftFromDefinition(row: KpiDefinition): KpiDefinitionDraft {
  return {
    metric_key: row.metric_key, dimension: row.dimension, dimension_value: row.dimension_value,
    label: row.label ?? '', unit: row.unit, comparison: row.comparison,
    target_value: row.target_value, warn_value: row.warn_value,
    surfaces: row.surfaces, active: row.active,
  }
}

// Deep-compare two surface lists regardless of order — a reorder-only change is not a change.
function surfacesEqual(a: KpiSurface[], b: KpiSurface[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every(s => setB.has(s))
}

export function useKpiDefinitionDraft(registry: KpiEntityRegistry | undefined, editing: KpiDefinition | null) {
  const [draft, setDraft] = useState<KpiDefinitionDraft>(() => (editing ? draftFromDefinition(editing) : emptyDraft()))

  const metric = useMemo(() => registry?.metrics.find(m => m.key === draft.metric_key), [registry, draft.metric_key])

  // One typed setter per field. A metric change always jumps `unit` to that
  // metric's own default_unit (the tenant can still override it afterwards —
  // that override sticks until the metric is changed again, since only a
  // metric change touches `unit` here).
  const setField = <K extends keyof KpiDefinitionDraft>(key: K, value: KpiDefinitionDraft[K]) => {
    setDraft(prev => {
      if (key === 'metric_key' && value !== prev.metric_key) {
        const next = registry?.metrics.find(m => m.key === value)
        return { ...prev, metric_key: value as string, unit: next?.default_unit ?? '' }
      }
      if (key === 'dimension' && value !== prev.dimension) {
        return { ...prev, dimension: value as string, dimension_value: null }
      }
      return { ...prev, [key]: value }
    })
  }

  const unit = draft.unit
  const valid = draft.metric_key !== '' && unit !== ''

  // Create body for the panel (entity is injected by the caller — this hook has no entity of its own).
  const createBody = () => ({
    metric_key: draft.metric_key,
    dimension: draft.dimension,
    dimension_value: draft.dimension === 'all' ? null : draft.dimension_value,
    label: draft.label.trim() || null,
    target_value: draft.comparison === 'none' ? null : draft.target_value,
    warn_value: draft.comparison === 'none' ? null : draft.warn_value,
    comparison: draft.comparison,
    unit: unit as KpiUnit,
    surfaces: draft.surfaces,
    active: draft.active,
  })

  // Only the keys that differ from the original row — PATCH sends nothing else.
  const changedKeys = (original: KpiDefinition) => {
    const body = createBody()
    const patch: Record<string, unknown> = {}
    if (body.metric_key !== original.metric_key) patch.metric_key = body.metric_key
    if (body.dimension !== original.dimension) patch.dimension = body.dimension
    if (body.dimension_value !== original.dimension_value) patch.dimension_value = body.dimension_value
    if (body.label !== original.label) patch.label = body.label
    if (body.target_value !== original.target_value) patch.target_value = body.target_value
    if (body.warn_value !== original.warn_value) patch.warn_value = body.warn_value
    if (body.comparison !== original.comparison) patch.comparison = body.comparison
    if (body.unit !== original.unit) patch.unit = body.unit
    if (!surfacesEqual(body.surfaces, original.surfaces)) patch.surfaces = body.surfaces
    if (body.active !== original.active) patch.active = body.active
    return patch
  }

  return { draft, setField, metric, valid, createBody, changedKeys }
}
