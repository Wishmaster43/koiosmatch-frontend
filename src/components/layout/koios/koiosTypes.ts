/**
 * koiosTypes — the fase-1 wire-contract additions (KOIOS-AGENT-PLAN §6/§7),
 * dormant until the backend half ships (feature-detected on the response — see
 * useKoiosChat/KoiosPanel). Declared as a MODULE AUGMENTATION of the existing
 * `@/types/koios` interfaces (never edited directly — outside this task's file
 * boundary) so `KoiosChatMessage.pendingAction` / `KoiosStep.refs` type-check
 * everywhere those interfaces are already used, with no changes to that file.
 */
import type { KoiosContextRef } from '@/types/koios'
import type { ActionBudget } from '@/types/actionBudget'

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

// Per-entity grouping metadata for search results (ZoekAlles tool).
// When present, the step includes this alongside refs[].
export interface KoiosSearchResultGroup {
  entity: 'candidate' | 'vacancy' | 'customer' | 'opportunity' | 'match'
  aantal?: number      // Total matching count before truncation
  meer?: boolean       // True if truncated (>5 results)
  overgeslagen?: { reden: string } | null  // When entity was skipped
}

// Grouped search results per entity, extracted from a zoek_alles step.
export interface KoiosSearchResultsGrouped {
  groups: Array<KoiosSearchResultGroup & { refs: KoiosResultRef[] }>
  skipped: Array<{ entity: string; reden: string }>
}

// POST /ai/koios/actions/{id}/confirm response (KOIOS-CONFIRM-DECLINE-1,
// PRIJSMODEL-C 30-08): a genuine tool refusal (staffel vol, kandidaat niet
// gevonden, …) is now a 422 { status: 'declined', message, data }, never the
// old 200 { status: 'executed', data: { fout } } false-positive. data.budget
// (ActionBudget) carries the staffel stand on a budget-full decline.
export interface KoiosConfirmActionResponse {
  status?: 'executed' | 'declined'
  message?: string
  data?: { budget?: ActionBudget; [key: string]: unknown }
}

declare module '@/types/koios' {
  interface KoiosChatMessage {
    pendingAction?: KoiosPendingAction | null
  }
  interface KoiosStep {
    refs?: KoiosResultRef[]
  }
}

// KOIOS-MEMORY-1: one earlier turn of the conversation as the chat endpoint receives it (text only, §9).
export interface KoiosChatTurn { role: 'user' | 'assistant'; content: string }

// K-147: the per-chat reasoning-effort override, the server's own scale (POST /ai/koios/chat `effort`).
export type KoiosEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
// The scale in ascending order — the picker ranks levels against the package ceiling with it.
export const KOIOS_EFFORT_LEVELS: KoiosEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']
