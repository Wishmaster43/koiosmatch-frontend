/**
 * richTextAssistApi — the ONE API layer behind the Koios assist that rides on
 * every rich-text field (Danny 08-08: "alle omschrijvingen moeten ook een mic
 * functionaliteit hebben en Koios AI"), INCLUDING action-item extraction
 * (CMFE-KOIOS-CONSISTENCY-1, Danny 09-08: "Actiepunten auto en wizard
 * ontbreekt" — the note composer's third mode now rides the shared bar too,
 * §11 one source: notes/noteAssistApi.ts re-exports from here instead of
 * keeping a second implementation).
 *
 * MEASURED LIVE against http://koiosmatch-api.test (2026-08-08, tenant yesway,
 * user danny@koios.nl) — not assumed:
 *  - POST /ai/koios/notes/assist IS entity-agnostic despite the "notes" path
 *    segment: it validates `{text, language, mode}` and runs the model over
 *    whatever text is posted, for all three modes (improve/summarize/actions).
 *    Probed: mode:"bogus" → 422 "The selected mode is invalid", text:"" → 422
 *    "The text field is required", a real body → the request reaches
 *    Anthropic (this box currently answers 500 from an exhausted upstream
 *    credit balance, an account state, not a contract problem). Route:
 *    routes/api/tenant/communication-ai.php, middleware module:koios_ai +
 *    permission:koios.use + throttle:30,1.
 *  - POST /ai/koios/generate (entity-generate) IS NOW WIRED (KOIOS-GENERATE-1,
 *    Danny 09-08 — supersedes the 08-08 "403 for everyone" note above, which was
 *    a permission-gate bug since fixed by CMBE commit 456ac45b). Re-measured live
 *    against KoiosEntityGenerateController.php: the request body is `{entity, id,
 *    instructions?}` — there is NO `field` key; the backend maps one entity kind
 *    to exactly one generated field (candidate → profile text, customer/location
 *    → description, match → match text), so a caller only ever supplies WHICH
 *    entity, never which field. A 402/503 failure here can carry a stable `code`
 *    (`koios_credit_exhausted` / `koios_unavailable`, ClaudeApiException::render())
 *    when the upstream Anthropic call itself fails — the SAME two codes
 *    extractApiError's apiErrorKey() already maps to translated common:errors.*
 *    text; the tenant's own monthly-budget 402 and the "no API key configured"
 *    503 carry no code and fall back to the server's own message. 403 = the
 *    caller lacks the entity's own *.view permission; 422 = the id no longer
 *    exists in this tenant (soft-deleted/cross-tenant).
 *
 * Hand-written types (§10): this route carries no openapi-typescript entry yet
 * (the generated spec documents request shapes + 401 only), so the success
 * shape below is hand-written by contract.
 */
import api from '@/lib/api'

// Three modes, identical for every rich-text field: rewrite / condense / pull
// out action items. 'actions' used to be note-only — CMFE-KOIOS-CONSISTENCY-1
// generalised it, matching what noteAssistApi.ts already ran.
export type RichTextAssistMode = 'improve' | 'summarize' | 'actions'

// The action-item types the backend can extract (NoteAssistPrompt::ACTION_TYPES) —
// anything else is dropped server-side before it ever reaches the FE.
export type RichTextAssistActionType = 'task' | 'whatsapp' | 'email' | 'appointment' | 'notification'
export interface RichTextAssistActionItem {
  title: string
  type: RichTextAssistActionType
  due_date: string | null
  note_excerpt: string | null
  // CMBE 5961c673 (verified live 2026-08-07, KoiosNoteAssistController::actionsResponse):
  // a draft text for whatsapp/email items, and a proposed start date-time for
  // appointment items — both always present on a fresh assist response but kept
  // OPTIONAL here (never required) so older fixtures that predate this field
  // keep compiling unchanged.
  message?: string | null
  start?: string | null
}
// Dutch fallback label per action-item type — the common:notesAssist.actionTypes.*
// keys are already shipped in all five locales; this map only backstops an
// unexpected type value the closed vocabulary above should never produce.
export const ACTION_TYPE_LABEL_NL: Record<RichTextAssistActionType, string> = {
  task: 'Taak', whatsapp: 'WhatsApp', email: 'E-mail', appointment: 'Afspraak', notification: 'Melding',
}
// improve/summarize return prose; actions returns structured items — one
// discriminated result so the caller never has to guess the shape by mode alone.
export type RichTextAssistResult =
  | { kind: 'text'; text: string }
  | { kind: 'actions'; items: RichTextAssistActionItem[] }

interface ApiTextResponse { text: string }
interface ApiActionsResponse { items: RichTextAssistActionItem[] }

/**
 * One assist call over the field's CURRENT html (the backend strips it to plain
 * text server-side, §7 boundary — the model never sees raw markup). 402 = the
 * tenant's monthly Koios budget is spent; 422 = the model could not produce a
 * usable answer; 503 = no Claude API key configured — all three are expected,
 * caller-handled outcomes, so quietStatuses keeps the console/toast quiet for
 * them. A longer timeout than the 20s default: this is a real Anthropic
 * round-trip, not a CRUD call.
 */
export async function assistRichText(
  { text, language, mode }: { text: string; language?: string; mode: RichTextAssistMode },
  signal?: AbortSignal,
): Promise<RichTextAssistResult> {
  const res = await api.post<ApiTextResponse | ApiActionsResponse>('/ai/koios/notes/assist',
    { text, language, mode },
    { signal, timeout: 60000, quietStatuses: [402, 422, 503] })
  return mode === 'actions'
    ? { kind: 'actions', items: (res.data as ApiActionsResponse).items ?? [] }
    : { kind: 'text', text: (res.data as ApiTextResponse).text ?? '' }
}

// Entities KoiosEntityGenerateController can write a suggestion for — mirrors its
// ENTITIES map 1:1. Kept as its OWN type (not folded into RichTextAssistMode):
// generate is a different request shape entirely (entity+id, never text+mode).
export type GenerateEntity = 'candidate' | 'customer' | 'location' | 'match'

interface ApiGenerateResponse { text: string }

/**
 * POST /ai/koios/generate — a fresh text suggestion written FROM the entity's own
 * data (name, function, skills, …), never from the field's current draft — so,
 * unlike improve/summarize, an EMPTY field is a valid starting point. Read-only:
 * this never persists anything, same review-then-Overnemen contract as the other
 * modes. See this file's header for the measured error-code contract.
 */
export async function generateEntityText(
  { entity, id }: { entity: GenerateEntity; id: string },
  signal?: AbortSignal,
): Promise<RichTextAssistResult> {
  const res = await api.post<ApiGenerateResponse>('/ai/koios/generate',
    { entity, id },
    { signal, timeout: 60000, quietStatuses: [402, 403, 422, 503] })
  return { kind: 'text', text: res.data.text ?? '' }
}
