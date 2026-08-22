/**
 * canvas ModuleNode · "not executable" marker (PICKER-INTERSECT) — a SAVED node
 * whose type the backend engine dropped support for renders an honest top-left
 * marker instead of disappearing; the node itself always keeps rendering fully.
 * Covers: a type missing from a non-empty catalog gets the marker, a type present
 * does not, a trigger-role type (registry category 'Triggers') never does, and an
 * empty catalog (still loading / fetch failed soft) never marks anything — a false
 * positive on every node while offline would be worse than no marker at all.
 *
 * @xyflow/react's Handle/Position are mocked out: ModuleNode only uses them for its
 * decorative connector dots, which need the real ReactFlow store/provider to render
 * — irrelevant to this marker and out of scope here.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NODE_TYPES } from './canvas'
import type { FlowNodeData } from '@/types/workflow'
import type { ModuleCatalog } from './filterFieldCatalog'

// ModuleNode only reads Handle/Position for its connector dots (decoration,
// irrelevant here) — stubbing them out avoids needing a real ReactFlowProvider.
vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))

// The catalog the mocked hook hands back — each test sets it before rendering.
let mockCatalog: ModuleCatalog = {}
// Realistic non-empty catalog: the engine map carries ~40 types, and the
// component's shape floor (>= 5 keys) treats smaller responses as corruption —
// fixtures mirror that reality instead of a bare single-key map.
const entry = { outputFields: {}, emits: 'passthrough' } as const
const realCatalog = (...types: string[]): ModuleCatalog =>
  Object.fromEntries(['tasks', 'matches', 'vacancies', 'wait', 'router', ...types].map(t => [t, { ...entry }]))

vi.mock('./useModuleCatalog', () => ({
  useModuleCatalog: () => ({ catalog: mockCatalog, loading: false }),
}))

const ModuleNode = NODE_TYPES.module

// Minimal saved-node shape: only `data.type` drives the marker logic under test.
const node = (type: string): { id: string; data: FlowNodeData } => ({ id: 'n1', data: { type } })

describe('ModuleNode · PICKER-INTERSECT "not executable" marker', () => {
  it('marks a saved node whose type is missing from a non-empty catalog', () => {
    mockCatalog = realCatalog('candidates')
    // 'condition' is a real FE-only spookmodule — absent from the engine's map.
    render(<ModuleNode {...node('condition')} />)
    expect(screen.getByLabelText('canvas.notExecutable')).toBeInTheDocument()
  })

  it('renders no marker when the type IS present in a non-empty catalog', () => {
    mockCatalog = realCatalog('candidates')
    render(<ModuleNode {...node('candidates')} />)
    expect(screen.queryByLabelText('canvas.notExecutable')).not.toBeInTheDocument()
  })

  it('never marks a trigger-role type even when missing from a non-empty catalog', () => {
    mockCatalog = realCatalog('candidates')
    // 'webhook' (category 'Triggers') starts a run — it is never an engine action.
    render(<ModuleNode {...node('webhook')} />)
    expect(screen.queryByLabelText('canvas.notExecutable')).not.toBeInTheDocument()
  })

  it('never marks anything while the catalog is empty (still loading / fetch failed soft)', () => {
    mockCatalog = {}
    render(<ModuleNode {...node('condition')} />)
    expect(screen.queryByLabelText('canvas.notExecutable')).not.toBeInTheDocument()
  })
})
