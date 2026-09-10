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
export interface KoiosAssistantAction {
  tool: string
  input?: Record<string, unknown>
  // KOIOS-PANEL-2 (CMBE spec): a human label (NL) plus an optional i18n key the FE
  // resolves first, the tool's args and the preview rows — all read tolerantly.
  label?: string | null
  label_key?: string | null
  args?: Record<string, unknown>
  preview?: KoiosPreviewRow[]
}

export type KoiosAssistantKind =
  | 'pending_action'
  | 'task_overdue'
  | 'candidate_no_contact'
  | 'opportunity_closing_soon'
  | 'vacancy_zero_applications'

export interface KoiosAssistantSuggestion {
  kind: KoiosAssistantKind
  title: string
  body: string
  action?: KoiosAssistantAction | null
  // KOIOS-PANEL-2: the row's real choices (afronden / verzetten / bellen …); the first
  // is the primary button, the rest sit in the row's menu. Absent → `action` as before.
  actions?: KoiosAssistantAction[] | null
  refs: KoiosContextRef[]
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
