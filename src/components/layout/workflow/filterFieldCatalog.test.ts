/**
 * Unit tests for the pure upstream-walk/collect logic (FILTER-VELD-1) — the walk
 * rule (start node's own fields + stop after the nearest `replace`), append/
 * passthrough continuation, and the sm_* own-key nesting/unwrap case are exactly
 * what the Make-style filter field picker depends on, so they're worth pinning
 * down explicitly. `collectUpstreamFilterFields` is always called with the id of
 * the node whose OUTGOING edge is being filtered (the edge's SOURCE) — the
 * backend evaluates edge filters against that node's own step output, so its
 * fields must be selectable too, not just its ancestors'.
 */
import { describe, it, expect } from 'vitest'
import {
  collectUpstreamFilterFields, toFilterFieldOptions,
  type ModuleCatalog, type FilterGraphNode, type FilterGraphEdge,
} from './filterFieldCatalog'

// Small shared catalog: one replace fetch, one append enrich, one passthrough
// control step, plus the sm_candidates own-key + iterator promotion pair.
const catalog: ModuleCatalog = {
  candidate_filter: { emits: 'replace', outputFields: { id: 'Kandidaat-ID', firstname: 'Voornaam' } },
  shift_fetch:      { emits: 'append',  outputFields: { shifts_count: 'Aantal beschikbare diensten' } },
  shift_score:      { emits: 'append',  outputFields: { best_shift: 'Beste dienst' } },
  router:           { emits: 'passthrough', outputFields: {} },
  wait:             { emits: 'passthrough', outputFields: {} },
  sm_candidates:    { emits: 'replace', outputFields: { id: 'Kandidaat-ID', name: 'Volledige naam' } },
  iterator:         { emits: 'passthrough', outputFields: {} },
}

describe('collectUpstreamFilterFields', () => {
  it('includes the start node itself and walks a replace → append → append chain, numbered furthest-first', () => {
    const nodes: FilterGraphNode[] = [
      { id: 'a', type: 'candidate_filter' },
      { id: 'b', type: 'shift_fetch' },
      { id: 'c', type: 'shift_score' }, // filtering the edge OUT of c
    ]
    const edges: FilterGraphEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ]
    const groups = collectUpstreamFilterFields('c', nodes, edges, catalog)
    expect(groups.map(g => g.moduleType)).toEqual(['candidate_filter', 'shift_fetch', 'shift_score'])
    expect(groups.map(g => g.number)).toEqual([1, 2, 3])
    expect(groups[0].fields.map(f => f.key)).toEqual(['id', 'firstname'])
    // The start node's OWN fields are included too (c = shift_score itself).
    expect(groups[2].fields).toEqual([{ key: 'best_shift', label: 'Beste dienst' }])
  })

  it('stops walking AFTER including the nearest replace module — nothing before it is collected', () => {
    const nodes: FilterGraphNode[] = [
      { id: 'trigger', type: 'candidate_filter' }, // an earlier replace, behind the boundary
      { id: 'a', type: 'candidate_filter' },
      { id: 'b', type: 'shift_fetch' },
    ]
    const edges: FilterGraphEdge[] = [
      { source: 'trigger', target: 'a' },
      { source: 'a', target: 'b' },
    ]
    const groups = collectUpstreamFilterFields('b', nodes, edges, catalog)
    // 'b' itself + the nearest replace ('a') — 'trigger' never appears.
    expect(groups.map(g => g.nodeId)).toEqual(['a', 'b'])
  })

  it('passthrough modules (router/wait) do not stop the walk and contribute no fields of their own', () => {
    const nodes: FilterGraphNode[] = [
      { id: 'a', type: 'candidate_filter' },
      { id: 'w', type: 'wait' },
      { id: 'b', type: 'shift_fetch' }, // filtering the edge OUT of b
    ]
    const edges: FilterGraphEdge[] = [
      { source: 'a', target: 'w' },
      { source: 'w', target: 'b' },
    ]
    const groups = collectUpstreamFilterFields('b', nodes, edges, catalog)
    expect(groups.map(g => g.moduleType)).toEqual(['candidate_filter', 'wait', 'shift_fetch'])
    expect(groups.find(g => g.moduleType === 'wait')?.fields).toEqual([])
  })

  it('an unknown module type (missing from the catalog) yields an empty-fields group, not a crash', () => {
    const nodes: FilterGraphNode[] = [{ id: 'a', type: 'mystery_module' }, { id: 'b', type: 'shift_fetch' }]
    const edges: FilterGraphEdge[] = [{ source: 'a', target: 'b' }]
    const groups = collectUpstreamFilterFields('b', nodes, edges, catalog)
    expect(groups[0]).toMatchObject({ moduleType: 'mystery_module', fields: [] })
    expect(groups[1]).toMatchObject({ moduleType: 'shift_fetch' })
  })

  it('sm_candidates fields are prefixed with its own key when nothing unwraps them', () => {
    // Filtering the edge right out of sm_candidates itself — no Iterator yet.
    const nodes: FilterGraphNode[] = [{ id: 'a', type: 'sm_candidates' }]
    const groups = collectUpstreamFilterFields('a', nodes, [], catalog)
    expect(groups[0].fields.map(f => f.key)).toEqual(['sm_candidates.id', 'sm_candidates.name'])
  })

  it('sm_candidates fields flatten once a downstream Iterator promotes its own key', () => {
    const nodes: FilterGraphNode[] = [
      { id: 'a', type: 'sm_candidates' },
      { id: 'it', type: 'iterator', config: { array_field: 'sm_candidates' } }, // filtering the edge OUT of it
    ]
    const edges: FilterGraphEdge[] = [{ source: 'a', target: 'it' }]
    const groups = collectUpstreamFilterFields('it', nodes, edges, catalog)
    expect(groups.find(g => g.moduleType === 'sm_candidates')?.fields.map(f => f.key)).toEqual(['id', 'name'])
  })

  it('sm_candidates stays prefixed when an Iterator promotes a DIFFERENT field', () => {
    const nodes: FilterGraphNode[] = [
      { id: 'a', type: 'sm_candidates' },
      { id: 'it', type: 'iterator', config: { array_field: 'sm_shifts' } },
    ]
    const edges: FilterGraphEdge[] = [{ source: 'a', target: 'it' }]
    const groups = collectUpstreamFilterFields('it', nodes, edges, catalog)
    expect(groups.find(g => g.moduleType === 'sm_candidates')?.fields.map(f => f.key)).toEqual(['sm_candidates.id', 'sm_candidates.name'])
  })

  it('a node with no predecessors still returns its own group (itself), never throws', () => {
    const nodes: FilterGraphNode[] = [{ id: 'a', type: 'candidate_filter' }]
    const groups = collectUpstreamFilterFields('a', nodes, [], catalog)
    expect(groups).toEqual([{ nodeId: 'a', moduleType: 'candidate_filter', number: 1, fields: [
      { key: 'id', label: 'Kandidaat-ID' }, { key: 'firstname', label: 'Voornaam' },
    ] }])
  })
})

describe('toFilterFieldOptions', () => {
  it('flattens groups into "N. <module> · <field>" labelled options carrying the field key as value', () => {
    const groups = collectUpstreamFilterFields(
      'c',
      [{ id: 'a', type: 'candidate_filter' }, { id: 'b', type: 'shift_fetch' }, { id: 'c', type: 'router' }],
      [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }],
      catalog,
    )
    const options = toFilterFieldOptions(groups, type => ({ candidate_filter: 'Kandidaten ophalen', shift_fetch: 'Open diensten per kandidaat' }[type] ?? type))
    expect(options).toEqual([
      { value: 'id', label: '1. Kandidaten ophalen · Kandidaat-ID' },
      { value: 'firstname', label: '1. Kandidaten ophalen · Voornaam' },
      { value: 'shifts_count', label: '2. Open diensten per kandidaat · Aantal beschikbare diensten' },
    ])
  })
})
