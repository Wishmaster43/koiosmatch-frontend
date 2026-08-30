/**
 * useModuleCatalog — fetches GET /workflows/modules ONCE per browser session
 * (module-level cache + shared in-flight promise) and exposes each type's
 * `output_fields` + `emits` (FILTER-VELD-1, Danny 2026-07-13) as a `ModuleCatalog`.
 * The FE's own module registry (`src/modules/index.ts`) is authored client-side
 * (labels/icons/schemas) and never carried this bundle-shape data, so the
 * filter-field picker is the first consumer that needs a live call here — every
 * mount reuses the same cached response instead of refetching (mirrors the lazy
 * `import('@/lib/api')` pattern used by FaqSelectField/WebhookSelectField).
 */
import { useEffect, useState } from 'react'
import type { ModuleCatalog, InstructionOutputField } from './filterFieldCatalog'
import { unwrap } from '@/lib/api'

let cache: ModuleCatalog | null = null
let inFlight: Promise<ModuleCatalog> | null = null

// Raw per-type module definition as GET /workflows/modules serves it. Both the
// SERVED output_field allow-list (INTERVIEW-WORKFLOW-1 Appendix E, CMBE delta
// 30-08: `schema.instructions.item_schema.output_field.options`, array OR a
// plain {key: label} object) and the LEGACY module-level `instruction_output_fields`
// array are accepted; served wins when both are present on the same response.
interface RawModuleDef {
  output_fields?: Record<string, string>
  emits?: string
  instruction_output_fields?: Array<{ key?: string; label?: string }>
  schema?: { instructions?: { item_schema?: { output_field?: { options?: unknown } } } }
}

// Normalizes the served `output_field.options` shape (array of {key,label}, or an
// object keyed by field name) into the flat InstructionOutputField[] the ConfigPanel
// consumes; an entry missing a non-empty `key` is dropped rather than rendered blank.
function servedOutputFields(options: unknown): InstructionOutputField[] | undefined {
  if (Array.isArray(options)) {
    return options
      .filter((o): o is { key: string; label?: string } => typeof (o as { key?: unknown })?.key === 'string' && (o as { key: string }).key.length > 0)
      .map(o => ({ key: o.key, label: o.label ?? o.key }))
  }
  if (options && typeof options === 'object') {
    return Object.entries(options as Record<string, unknown>)
      .filter(([key]) => key.length > 0)
      .map(([key, label]) => ({ key, label: typeof label === 'string' && label.length > 0 ? label : key }))
  }
  return undefined
}

// Normalizes the LEGACY module-level allow-list (pre-Appendix-E shape, still
// accepted as a fallback when a type has no served options yet).
function legacyOutputFields(list: Array<{ key?: string; label?: string }> | undefined): InstructionOutputField[] | undefined {
  return Array.isArray(list)
    ? list
      .filter((f): f is { key: string; label?: string } => typeof f?.key === 'string' && f.key.length > 0)
      .map(f => ({ key: f.key, label: f.label ?? f.key }))
    : undefined
}

// Normalize the raw /workflows/modules response (per type: output_fields + emits
// + the instruction-list output-field allow-list, served or legacy shape) into
// the flat catalog map; an unrecognised emits value fails safe to passthrough.
export function normalize(raw: Record<string, unknown>): ModuleCatalog {
  const out: ModuleCatalog = {}
  for (const [type, def] of Object.entries(raw ?? {})) {
    const d = def as RawModuleDef
    out[type] = {
      outputFields: d.output_fields ?? {},
      emits: d.emits === 'replace' || d.emits === 'append' ? d.emits : 'passthrough',
      instructionOutputFields: servedOutputFields(d.schema?.instructions?.item_schema?.output_field?.options)
        ?? legacyOutputFields(d.instruction_output_fields),
    }
  }
  return out
}

// Fetch once and cache; concurrent callers during the first fetch share one request.
async function fetchCatalog(): Promise<ModuleCatalog> {
  if (cache) return cache
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const api = (await import('@/lib/api')).default
        const res = await api.get('/workflows/modules')
        cache = normalize(unwrap(res) ?? {})
      } catch {
        // Fail soft: an empty catalog just means the picker shows no fields yet
        // (the manual/custom CreatableSelect path still lets a user type one).
        cache = {}
      }
      return cache
    })()
  }
  return inFlight
}

// Exposes the session-cached module catalog (see file docblock above) as component
// state, so every consumer re-renders once the shared fetch resolves.
export function useModuleCatalog(): { catalog: ModuleCatalog; loading: boolean } {
  const [catalog, setCatalog] = useState<ModuleCatalog>(cache ?? {})
  const [loading, setLoading] = useState(!cache)

  // Reuse the cached/in-flight fetch; only the first mount in a session waits.
  useEffect(() => {
    if (cache) { setCatalog(cache); setLoading(false); return }
    let alive = true
    fetchCatalog().then(result => { if (alive) { setCatalog(result); setLoading(false) } })
    return () => { alive = false }
  }, [])

  return { catalog, loading }
}
