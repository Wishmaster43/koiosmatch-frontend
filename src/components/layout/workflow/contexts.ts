import { createContext } from 'react'
import type { FlowNodeData } from '@/types/workflow'

/**
 * Canvas ↔ editor context wiring. The providers live in EditorInner; the consumers
 * are the canvas node/edge components. Shared here so both sides reference the same
 * context objects (importing them from two places would create separate contexts).
 */

// An edge action (insert/delete/filter) keyed by the edge id.
export type EdgeFn = (edgeId: string) => void
// Run one node's module — id + its data; may be async.
export type NodeRunFn = (id: string, data: FlowNodeData) => void | Promise<void>
// Negotiates which node is the workflow entry point (drag-and-drop).
export interface StartCtxValue { startNodeId: string | null; setStartNodeId: (id: string | null) => void }

export const EdgeAddContext    = createContext<EdgeFn | null>(null)
export const EdgeDeleteContext = createContext<EdgeFn | null>(null)
export const EdgeFilterContext = createContext<EdgeFn | null>(null)
export const NodeRunContext    = createContext<NodeRunFn | null>(null)
// Provides { startNodeId, setStartNodeId } so the START badge and nodes can
// negotiate which node is the workflow entry point via drag-and-drop.
export const StartContext      = createContext<StartCtxValue | null>(null)
