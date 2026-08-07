/**
 * noteAssistApi — thin API layer for NOTE-ASSIST-1 (F3): improve / summarize /
 * extract action items from a note via Koios AI. SUGGESTIONS ONLY — this never
 * persists or executes anything (F4's real action-creation bridge is a later
 * wave). Hand-written types (§10): this freshly landed route has no
 * openapi-typescript entry yet — mirrors vacancyGenerateApi.ts's shape.
 */
import api from '@/lib/api'

export type AssistMode = 'improve' | 'summarize' | 'actions'
// The action-item types the backend can extract (NoteAssistPrompt::ACTION_TYPES) —
// anything else is dropped server-side before it ever reaches the FE.
export type AssistActionType = 'task' | 'whatsapp' | 'email' | 'appointment' | 'notification'
export interface AssistActionItem {
  title: string
  type: AssistActionType
  due_date: string | null
  note_excerpt: string | null
}
// improve/summarize return prose; actions returns structured items — one
// discriminated result so the caller never has to guess the shape by mode alone.
export type AssistResult =
  | { kind: 'text'; text: string }
  | { kind: 'actions'; items: AssistActionItem[] }

interface ApiTextResponse { text: string }
interface ApiActionsResponse { items: AssistActionItem[] }

/**
 * POST /ai/koios/notes/assist — one assist call over the CURRENT note text (the
 * editor's HTML; the backend strips it to plain text server-side, §7 boundary —
 * the model never sees raw markup). 402 = the tenant's Koios budget is exhausted
 * this month; 422 = actions mode could not parse a usable list — both are
 * expected, caller-handled outcomes (see useNoteAssist), so quietStatuses keeps
 * the dev console/toast quiet for them (mirrors the 404/503 convention already
 * used in vacancyGenerateApi.ts). A longer timeout than the 20s default: this is
 * a real Anthropic round-trip over a whole note, not a CRUD call.
 */
export async function assistNote(
  { text, language, mode }: { text: string; language?: string; mode: AssistMode },
  signal?: AbortSignal,
): Promise<AssistResult> {
  const res = await api.post<ApiTextResponse | ApiActionsResponse>('/ai/koios/notes/assist',
    { text, language, mode },
    { signal, timeout: 60000, quietStatuses: [402, 422, 503] })
  return mode === 'actions'
    ? { kind: 'actions', items: (res.data as ApiActionsResponse).items ?? [] }
    : { kind: 'text', text: (res.data as ApiTextResponse).text ?? '' }
}
