/**
 * koiosSearchResultsGrouping (KOIOS-TOOL-RESULT-KEYS-3 phase B): the pure grouping of a search_all step's
 * per-entity result buckets (English bucket names only since BE MINI-BUNDLE-12; the Dutch alias table is gone)
 * into the result-card groups and the skipped list. Kept out of KoiosMessage.tsx so the component file exports
 * only components (react-refresh) and the attribution is unit-testable without rendering.
 */
import type { KoiosResultRef, KoiosSearchResultsGrouped } from './koiosTypes'

// ── Group search results by entity type ────────────────────────────────────────
// Maps backend entity keys to FE ref types. KOIOS-EN-1 phase B: the search_all
// result's per-entity keys are English plurals only since KOIOS-TOOL-RESULT-KEYS-3
// (BE MINI-BUNDLE-12 dropped the Dutch twins; the FE alias table went with it, so an
// old Dutch-keyed payload no longer groups). FIND-1 (BE FIND-1/FIND-1b) widened
// `search_all`'s buckets past the original five to contacts/tasks/locations.
const ENTITY_TYPE_MAP: Record<string, string> = {
  matches: 'match',
  candidates: 'candidate',
  vacancies: 'vacancy',
  customers: 'customer',
  opportunities: 'opportunity',
  contacts: 'contact',
  tasks: 'task',
  locations: 'location',
}

// Extracts per-entity search metadata and groups refs by entity type.
// If the backend sends full metadata in the step (e.g. for a search_all tool),
// this parses it; otherwise, reconstructs grouping from refs alone.
// Exported for the KOIOS-TOOL-RESULT-KEYS-3 pin (bucket attribution by English name only); the UI uses it only here.
export function groupSearchResults(step: Record<string, unknown>, refs: KoiosResultRef[]): KoiosSearchResultsGrouped {
  const groups: KoiosSearchResultsGrouped['groups'] = []
  const skipped: KoiosSearchResultsGrouped['skipped'] = []

  // Try to extract per-entity metadata from the step if present (the backend may include raw
  // tool output as { query, result: {...} }, older steps under `results`); the keys are English-only
  // since KOIOS-TOOL-RESULT-KEYS-2 (BE batch I).
  const rawResult = (step.result ?? step.results) as Record<string, unknown> | undefined
  const bucketsByEntity = rawResult || {}

  // Group refs by entity type in the canonical order
  const refsByEntity = new Map<string, KoiosResultRef[]>()
  for (const ref of refs) {
    const list = refsByEntity.get(ref.type) || []
    list.push(ref)
    refsByEntity.set(ref.type, list)
  }

  // Render groups in a canonical order, then anything else the backend sent
  // (FIND-1: a bucket key this FE has never seen still gets its own group,
  // never silently dropped: the raw key is the fallback entity label).
  const entityOrder = ['candidate', 'vacancy', 'customer', 'opportunity', 'match', 'contact', 'task', 'location']
  const seen = new Set<string>()
  const bucketEntityTypes = Object.keys(bucketsByEntity).map((key) => ENTITY_TYPE_MAP[key] || key)
  const refEntityTypes = Array.from(refsByEntity.keys())
  for (const entityType of [...entityOrder, ...bucketEntityTypes, ...refEntityTypes]) {
    if (seen.has(entityType)) continue
    seen.add(entityType)
    const entityRefs = refsByEntity.get(entityType) || []
    const bucketKey = Object.keys(bucketsByEntity).find((key) => (ENTITY_TYPE_MAP[key] || key) === entityType)
    if (entityRefs.length > 0 || (bucketKey && bucketsByEntity[bucketKey])) {
      groups.push({
        entity: entityType,
        refs: entityRefs,
        count: entityRefs.length,
        more: false,
      })
    }
  }

  // Collect skipped entities from the step's per-entity metadata (`skipped` + `reason`, English-only
  // since KOIOS-TOOL-RESULT-KEYS-1 and -2).
  for (const [key, value] of Object.entries(bucketsByEntity)) {
    const entry = value as Record<string, unknown>
    const isSkipped = entry.skipped === true
    const reason = entry.reason
    if (isSkipped && typeof reason === 'string') {
      const entityType = ENTITY_TYPE_MAP[key] || key
      skipped.push({ entity: entityType, reason })
    }
  }

  return { groups, skipped }
}
