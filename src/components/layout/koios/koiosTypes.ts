/**
 * koiosTypes — the fase-1 wire-contract additions (KOIOS-AGENT-PLAN §6/§7),
 * dormant until the backend half ships (feature-detected on the response — see
 * useKoiosChat/KoiosPanel). Declared as a MODULE AUGMENTATION of the existing
 * `@/types/koios` interfaces (never edited directly — outside this task's file
 * boundary) so `KoiosChatMessage.pendingAction` / `KoiosStep.refs` type-check
 * everywhere those interfaces are already used, with no changes to that file.
 */
import type { KoiosContextRef } from '@/types/koios'

// One preview row inside a pending action's diff (update: label + before/after;
// create/send: label + a plain text line). All fields optional — a row renders
// whichever it has.
export interface KoiosPreviewRow {
  label: string
  before?: string | null
  after?: string | null
  text?: string | null
}

// The tagged record a pending action targets — mirrors a context ref's shape
// plus an optional owner name (shown next to the chip so a human confirms
// knowingly when mutating someone else's record, KOIOS-AGENT-PLAN §4.5).
export interface KoiosEntityRef {
  type: string
  id: string
  label: string
  owner?: string | null
}

// A write the model wants to make, held server-side until confirmed (§6).
export interface KoiosPendingAction {
  id: string
  tool: string
  title: string
  entity_ref: KoiosEntityRef
  preview: KoiosPreviewRow[]
  warning?: { popup_code?: string | null; message: string } | null
  destructive: boolean
  expires_at: string
}

// A result-card deep link, attached to a tool step's read output (Job 3).
export type KoiosResultRef = KoiosContextRef

declare module '@/types/koios' {
  interface KoiosChatMessage {
    pendingAction?: KoiosPendingAction | null
  }
  interface KoiosStep {
    refs?: KoiosResultRef[]
  }
}
