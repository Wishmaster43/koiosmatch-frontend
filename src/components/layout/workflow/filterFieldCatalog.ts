/**
 * filterFieldCatalog — pure upstream-walk logic for the Make-style filter field
 * picker (FILTER-VELD-1, Danny 2026-07-13). Given the persisted graph (nodes +
 * edges), the backend's per-type module catalog (`output_fields` + `emits` from
 * GET /workflows/modules), and the id of the node whose OUTGOING edge is being
 * filtered (i.e. the edge's SOURCE — the backend evaluates edge filters against
 * that node's own step output, `RunWorkflowStep::inputFor`), collects that
 * module's OWN fields plus every ancestor's up to and INCLUDING the nearest
 * `emits: 'replace'` module — the backend's own walk rule (BaseModule::emits
 * docblock): a replace module discards whatever bundle shape existed before it,
 * so nothing further back is still on the record; `append`/`passthrough`
 * modules keep the record set (and its earlier fields) alive, so the walk keeps
 * going past them.
 *
 * Numbering is Make-style: furthest ancestor = 1, the start node itself =
 * highest — position WITHIN the walked chain (not the whole canvas), so
 * "3. Ingeplande diensten" reads left-to-right exactly like the modules the
 * user just chained.
 *
 * Special case (BE note, FILTER-VELD-1): sm_candidates/sm_customers/sm_shifts
 * emit their fresh mirror slice under their OWN key (e.g. `sm_candidates`), not
 * flattened onto the record — meant to be promoted by a downstream Iterator
 * (`array_field: sm_candidates`). Until such an Iterator sits between it and
 * the current edge, its fields are only reachable as `sm_candidates.<field>`;
 * once promoted, they read like any other flat field.
 */

// The backend's per-module walk rule (BaseModule::emits) — replace/append/passthrough.
export type ModuleEmits = 'replace' | 'append' | 'passthrough'

// One backend module type's static bundle-field catalog entry (GET /workflows/modules).
export interface ModuleCatalogEntry {
  outputFields: Record<string, string>
  emits: ModuleEmits
}
export type ModuleCatalog = Record<string, ModuleCatalogEntry>

// Minimal graph shapes the walk needs — deliberately looser than FlowNode/FlowEdge
// (ReactFlow) so this file stays framework-free and trivial to unit test.
export interface FilterGraphNode {
  id: string
  type: string
  config?: Record<string, unknown>
}
export interface FilterGraphEdge {
  source: string
  target: string
}

// One selectable field on an upstream module's bundle.
export interface FilterFieldOption {
  key: string   // the dot-path expression to store as the condition's `field`
  label: string // the backend catalog label (server-supplied; see report BE-i18n gap)
}

// One numbered group in the picker — one upstream module + its available fields.
export interface FilterFieldGroup {
  nodeId: string
  moduleType: string
  number: number   // 1-based position in the WALKED chain, furthest ancestor = 1
  fields: FilterFieldOption[]
}

// Module types whose fresh record set rides under their OWN key instead of being
// the flat bundle shape (see file header). A future BE-added type of the same
// shape only needs adding here — the walk logic itself never changes.
const OWN_KEY_TYPES = new Set(['sm_candidates', 'sm_customers', 'sm_shifts'])

// Strip Make-style "{{...}}" braces some configs allow around a field reference
// (mirrors IteratorModule::execute's own trim), so "{{sm_candidates}}" still matches.
const stripBraces = (v: string) => v.trim().replace(/^\{+|\}+$/g, '').trim()

/**
 * Return one group per module in `startNodeId`'s own chain — itself first
 * (nearest), then its ancestors walked backward — furthest-first once numbered,
 * stopping after (and including) the nearest `replace` module per branch. Pure
 * + sync — no network, no React.
 */
export function collectUpstreamFilterFields(
  startNodeId: string,
  nodes: FilterGraphNode[],
  edges: FilterGraphEdge[],
  catalog: ModuleCatalog,
): FilterFieldGroup[] {
  const byId = new Map(nodes.map(n => [n.id, n]))

  // BFS backward FROM the start node itself (ring 0), nearest-ring first; stop
  // expanding a branch past a `replace` module (its own predecessors sit behind
  // the boundary the backend itself resets at, so their fields are never on the
  // record downstream).
  const chain: string[] = []
  const seen = new Set<string>()
  let frontier = [startNodeId]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      if (seen.has(id)) continue
      seen.add(id)
      chain.push(id)
      const type = byId.get(id)?.type ?? ''
      const emits = catalog[type]?.emits ?? 'passthrough'
      if (emits !== 'replace') {
        edges.filter(e => e.target === id).forEach(e => next.push(e.source))
      }
    }
    frontier = next
  }

  // Furthest ancestor first (Make-style numbering: 1 = furthest back).
  const ordered = chain.reverse()

  return ordered.map((id, i) => {
    const type = byId.get(id)?.type ?? ''
    const outputFields = catalog[type]?.outputFields ?? {}

    // A NEARER Iterator (walked after this one, i.e. later in furthest-first
    // order) whose `array_field` names this module's own key promotes its
    // nested set to flat bundle fields — see file header.
    const unwrapped = OWN_KEY_TYPES.has(type) && ordered.slice(i + 1).some(laterId => {
      const later = byId.get(laterId)
      if (later?.type !== 'iterator') return false
      return stripBraces(String(later.config?.array_field ?? '')) === type
    })
    const prefix = OWN_KEY_TYPES.has(type) && !unwrapped ? `${type}.` : ''

    return {
      nodeId: id,
      moduleType: type,
      number: i + 1,
      fields: Object.entries(outputFields).map(([key, label]) => ({ key: `${prefix}${key}`, label })),
    }
  })
}

/**
 * Flatten the walked groups into Make-style numbered options for a flat combo
 * (CreatableSelect): "N. <module label> · <field label>" → the field's dot-path
 * expression. `moduleLabel` is injected so this stays translation-agnostic.
 */
export function toFilterFieldOptions(
  groups: FilterFieldGroup[],
  moduleLabel: (type: string) => string,
): Array<{ value: string; label: string }> {
  return groups.flatMap(g =>
    g.fields.map(f => ({ value: f.key, label: `${g.number}. ${moduleLabel(g.moduleType)} · ${f.label}` }))
  )
}
