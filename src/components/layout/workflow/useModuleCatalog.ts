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
import type { ModuleCatalog } from './filterFieldCatalog'
import { unwrap } from '@/lib/api'

let cache: ModuleCatalog | null = null
let inFlight: Promise<ModuleCatalog> | null = null

// Normalize the raw /workflows/modules response (per type: output_fields + emits)
// into the flat catalog map; an unrecognised emits value fails safe to passthrough.
function normalize(raw: Record<string, unknown>): ModuleCatalog {
  const out: ModuleCatalog = {}
  for (const [type, def] of Object.entries(raw ?? {})) {
    const d = def as { output_fields?: Record<string, string>; emits?: string }
    out[type] = {
      outputFields: d.output_fields ?? {},
      emits: d.emits === 'replace' || d.emits === 'append' ? d.emits : 'passthrough',
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
