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
 *  - POST /ai/koios/generate (entity-generate) is DELIBERATELY NOT CALLED from
 *    here. Measured the same session for entity ∈ candidate|customer|location|
 *    match with real ids: every one answers 403 "Onvoldoende rechten om deze
 *    gegevens te gebruiken." — even for a super admin holding "*". Wiring a
 *    "Genereren" button onto a route that always refuses would be a dead
 *    affordance (§3), so the bar does not render one until the backend gate is
 *    fixed. Reported as a backend gap.
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
