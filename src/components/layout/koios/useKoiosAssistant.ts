/**
 * useKoiosAssistant — fetches the Koios panel's landing-state assistant
 * suggestions (KOIOS-ASSISTANT-FE-1, K-148): GET /ai/koios/assistant returns
 * up to 10 already urgency-sorted suggestions. Server order is authoritative —
 * this hook never re-sorts. react-query (K-33 standard for server state);
 * mount-gated by the panel's landing branch (the block only exists there)
 * (mirrors useKoiosSettings' own open-gated fetch).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import type { KoiosContextRef } from '@/types/koios'
import type { KoiosPreviewRow } from './koiosTypes'

// One tool call the model proposes for a suggestion. Golf 2: parked actions
// (pending_action + ref) confirm/cancel via koiosApi; descriptor kinds hand
// their intent to the chat composer.
// KOIOS-SUGGEST-COMPACT-1 (CMBE addendum, landed 28-09): `key` is the ACTION
// identity (complete_task, reschedule_task, send_whatsapp, create_task,
// search_candidates — several share one registry `tool`); `label_key` reads
// `koios.assistant.actions.<key>`, `tool_label_key` reads `koios.tools.<tool>`.
export interface KoiosAssistantAction {
  tool: string
  key?: string | null
  input?: Record<string, unknown>
  // KOIOS-PANEL-2 (CMBE spec): a human label (NL) plus an optional i18n key the FE
  // resolves first, the tool's args and the preview rows — all read tolerantly.
  label?: string | null
  label_key?: string | null
  tool_label_key?: string | null
  args?: Record<string, unknown>
  preview?: KoiosPreviewRow[]
}

export type KoiosAssistantKind =
  | 'pending_action'
  | 'task_overdue'
  | 'candidate_no_contact'
  | 'interview_stalled'
  | 'opportunity_closing_soon'
  | 'vacancy_zero_applications'

// KOIOS-SUGGEST-COMPACT-1 (CMBE addendum, landed 28-09): per-kind typed data
// for the SHORT reason line, so the row never has to parse the server's Dutch
// prose. Hand-written — the spec carries no 2xx schema yet. Still optional:
// the row renders honestly on an older payload without it.
export interface KoiosSuggestionTaskType { key?: string; label?: string; color?: string | null; icon?: string | null }
export type KoiosSuggestionParams =
  | { days_overdue: number; due_at?: string | null; task_type?: KoiosSuggestionTaskType | null }
  | { days_since_contact: number | null; last_contact_at?: string | null }
  | { days_to_close: number; close_at?: string | null }
  | { days_open: number }
  | { tool: string }

export interface KoiosAssistantSuggestion {
  kind: KoiosAssistantKind
  title: string
  body: string
  action?: KoiosAssistantAction | null
  // KOIOS-PANEL-2: the row's real choices (afronden / verzetten / bellen …); the first
  // is the primary button, the rest sit in the row's menu. Absent → `action` as before.
  actions?: KoiosAssistantAction[] | null
  refs: KoiosContextRef[]
  // KOIOS-SUGGEST-COMPACT-1: typed per-kind data driving the short reason line.
  params?: KoiosSuggestionParams | null
}

interface AssistantResponse { suggestions: KoiosAssistantSuggestion[] }

// Fetches the assistant suggestions. `enabled` lets the panel share the cached
// list for its greeting ("er zijn N aandachtspunten") without a fetch while closed.
export function useKoiosAssistant(enabled = true) {
  const query = useQuery({
    queryKey: ['koios', 'assistant'],
    queryFn: () => api.get('/ai/koios/assistant').then((res) => unwrap<AssistantResponse>(res)),
    staleTime: 60_000,
    enabled,
  })
  return {
    suggestions: query.data?.suggestions ?? [],
    loading: query.isLoading,
    error: query.isError,
    refetch: query.refetch,
  }
}
