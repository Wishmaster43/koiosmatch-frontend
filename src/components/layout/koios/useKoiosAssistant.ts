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

// One tool call the model proposes for a suggestion (execute seam not wired
// yet — the caller only shows an availability hint, never a live button).
export interface KoiosAssistantAction {
  tool: string
  input: Record<string, unknown>
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
  refs: KoiosContextRef[]
}

interface AssistantResponse { suggestions: KoiosAssistantSuggestion[] }

// Fetches the assistant suggestions; the panel's landing branch mount-gates the call.
export function useKoiosAssistant() {
  const query = useQuery({
    queryKey: ['koios', 'assistant'],
    queryFn: () => api.get('/ai/koios/assistant').then((res) => unwrap<AssistantResponse>(res)),
    staleTime: 60_000,
  })
  return {
    suggestions: query.data?.suggestions ?? [],
    loading: query.isLoading,
    error: query.isError,
    refetch: query.refetch,
  }
}
