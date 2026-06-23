import { createContext } from 'react'

/**
 * Canvas ↔ editor context wiring. The providers live in EditorInner; the consumers
 * are the canvas node/edge components. Shared here so both sides reference the same
 * context objects (importing them from two places would create separate contexts).
 */
export const EdgeAddContext    = createContext(null)
export const EdgeDeleteContext = createContext(null)
export const EdgeFilterContext = createContext(null)
export const NodeRunContext    = createContext(null)
