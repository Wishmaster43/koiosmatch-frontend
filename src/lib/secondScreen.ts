/**
 * secondScreen — opens a standalone, id-driven page in a REAL separate browser
 * window (NOTITIE-POPOUT-1 F5, "Trap B" of NOTITIE-POPOUT-PLAN.md). A draggable
 * in-window panel (FloatingPanel, "Trap A") can never reach a second monitor —
 * the browser has no API to drag a DOM element outside its own window — so the
 * second-screen case needs an actual `window.open`. The httpOnly-cookie session,
 * theme and language all bootstrap automatically in the new window (same origin,
 * same session) — nothing extra to wire for auth/theming here.
 *
 * F5-UITBREIDING (Danny GO): generalised beyond candidates to CUSTOMERS and
 * VACANCIES notes. `entity` picks the popout route/window (`/popout/notes/
 * {entity}/{id}`) — one window per entity+id, so re-opening the same entity's
 * notes twice re-focuses the existing OS window instead of spawning a duplicate.
 *
 * NAMED WINDOW: passing the same `windowName` on a second call re-focuses the
 * existing OS window instead of spawning a duplicate, so clicking "pop out" twice
 * on the same record never litters the desktop with two windows fighting over
 * one note thread.
 */

// The three entities whose notes tab can pop out to a second screen. Mirrors the
// dynamic `:entity` route segment in App.tsx and the entity dispatch in
// pages/popout/NotesPopoutPage.tsx — keep the three in sync.
export type PopoutEntity = 'candidate' | 'customer' | 'vacancy'

/**
 * Feature string for every second-screen window this app opens, sized to the
 * screen it lands on rather than to a fixed number.
 *
 * It used to be a flat 560x720 (Danny 11-08: "scherm pop-out is erg klein"). A
 * fixed size cannot be right twice: on a 27" monitor 560px is a sliver, on a
 * laptop the same number is reasonable. This takes a share of the available
 * screen with a floor and a ceiling — wide enough to actually write in, never so
 * wide that it stops being a SIDE window you can put next to the app. Centred on
 * the available area so it does not open half off-screen on a second monitor.
 *
 * Falls back to the old fixed size where `screen` is unavailable (tests, jsdom).
 */
function popupFeatures(): string {
  const avail = typeof window !== 'undefined' ? window.screen : undefined
  if (!avail?.availWidth || !avail?.availHeight) return 'popup=yes,width=560,height=720'
  const width = Math.round(Math.min(1100, Math.max(720, avail.availWidth * 0.5)))
  const height = Math.round(Math.min(1000, Math.max(640, avail.availHeight * 0.85)))
  // availLeft/availTop are non-standard (Firefox/Safari) but are what places the
  // window on the RIGHT monitor in a multi-screen setup — read defensively.
  const offset = avail as Screen & { availLeft?: number; availTop?: number }
  const left = Math.round((avail.availWidth - width) / 2 + (offset.availLeft ?? 0))
  const top = Math.round((avail.availHeight - height) / 2 + (offset.availTop ?? 0))
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`
}

// Legacy single-arg overload (candidate id only) — kept so the originally shipped
// candidate call site (candidates/drawer/CommunicationTab.tsx) keeps compiling and
// behaving unchanged; defaults to entity='candidate'.
export function openNotesPopout(candidateId: string | number): Window | null
// F5-uitbreiding: explicit entity + id — the generalised second-screen entry point
// customer/vacancy hosts call.
export function openNotesPopout(entity: PopoutEntity, id: string | number): Window | null
// Opens (or focuses, if already open) an entity's notes popout. Returns the
// WindowProxy on success, or null when the browser blocked the popup — the
// caller decides how to surface that (a notify() warning, i18n key `common:popupBlocked`).
export function openNotesPopout(a: PopoutEntity | string | number, b?: string | number): Window | null {
  const entity: PopoutEntity = b === undefined ? 'candidate' : (a as PopoutEntity)
  const id: string | number = b === undefined ? (a as string | number) : b
  return window.open(`/popout/notes/${entity}/${id}`, `koios-notes-${entity}-${id}`, popupFeatures())
}

/**
 * NOTITIE-POPOUT-HANDOFF-1 (Danny 09/10-08): identity of ONE note handoff — the
 * BroadcastChannel topic the drill-down's note composer and the second-screen
 * notes window move a half-typed note over (hooks/useNotesPopout). Deliberately
 * built like `textPopoutTopic` below — same recipe, one mechanism (§11) — and
 * scoped per entity+id so two records can never swap drafts.
 */
export const noteDraftTopic = (entity: PopoutEntity, id: string | number) => `koios-note-draft-${entity}-${id}`

/**
 * NOTITIE-POPOUT-EDIT-1 (Danny 10-08: "icon moet onder change en prullenbakje
 * komen … en direct edit pop-out"): which entities' popout WINDOW can actually
 * SAVE an edit to an existing note. Measured against the running API on 10-08
 * (routes/api/tenant/*.php + the generated spec), re-verified 13-08 (K15NOTES):
 *   candidate → PATCH /candidates/{id}/notes/{note} exists AND CandidateNotesPopout
 *               wires onEditNote, so a handed-over note is patched in place.
 *   customer  → PATCH/DELETE /customers/{id}/notes/{note} now exist (K15NOTES) and
 *               the customer DRAWER + the whole-thread CustomerNotesPopout both
 *               wire onEditNote/onDeleteNote (real edit works there today). This
 *               set gates a DIFFERENT surface though — the per-note URL window
 *               (NoteEditPopout.tsx, opened via openNoteEditPopout below) — which
 *               is still hardcoded to useCandidateLite/useCandidateNotes; adding
 *               'customer' here without also generalising THAT page would show a
 *               pop-out icon that opens a window trying to load a candidate by a
 *               customer id (broken, not merely a duplicate-note risk). Widen this
 *               set ONLY once NoteEditPopout.tsx itself dispatches by entity.
 *   vacancy   → GET/POST + DELETE /vacancies/{id}/notes/{note} — still no PATCH.
 * Handing an EXISTING note to a window that can only ADD would persist it as a
 * SECOND note: a duplicate the recruiter cannot tell apart from the original and
 * that no undo removes. So customer/vacancy still render no per-note pop-out-to-
 * new-window button (§3, no fake affordance) — only the inline drawer edit and
 * the whole-thread popout's edit are live for customer today.
 */
export const NOTE_EDIT_POPOUT_ENTITIES: ReadonlySet<PopoutEntity> = new Set<PopoutEntity>(['candidate'])

/**
 * NOTITIE-POPOUT-URL-1 (Danny 11-08 "zet het notitie-id in de URL", live 13-08
 * "zoals de pop-out van de profieltekst"): ONE existing note edits in a window of
 * its OWN, addressed by URL — no channel handoff to resolve, no race against the
 * thread window's own loading, and re-opening the same note re-focuses its
 * window. Only entities in NOTE_EDIT_POPOUT_ENTITIES have this route (the window
 * must be able to really PATCH the note — see that set's docblock).
 */
export function openNoteEditPopout(entity: PopoutEntity, id: string | number, noteId: string): Window | null {
  return window.open(`/popout/notes/${entity}/${id}/${noteId}`, `koios-note-${entity}-${id}-${noteId}`, popupFeatures())
}

/**
 * TEKST-POPOUT-1 (Danny 08-08, punt 2): the SAME second-screen mechanism for a
 * single free-text field — today the candidate's profile text. Notes pop out a
 * whole thread; this pops out ONE field so the recruiter can write it full-size
 * on a second monitor while the drill-down stays where it was. Deliberately the
 * same `window.open` + named-window recipe as openNotesPopout above (§11: one
 * mechanism, never a second implementation) — only the route differs.
 */
// The free-text fields that own a second-screen editor. One entry per field the
// route dispatcher (pages/popout/TextPopoutPage.tsx) knows how to render.
// `matchRemarks` (batch 5, P34) mirrors the "+Match" Opmerkingen field — keyed by
// the candidate id since a not-yet-created match has none of its own; it only
// mirrors the draft between windows (no independent server save — the real
// persistence is the match form's own submit).
// `companyText`/`departmentText` (K3/K5, batch 5): the customer's bedrijfstekst
// and a department's omschrijving get the same profile-text treatment. Both ride
// under entity 'customer' (there is no separate PopoutEntity for a department —
// it is a sub-record of a customer, mirrors how its notes/documents already scope
// under the customer). `departmentText`'s `id` is the COMPOSITE
// `departmentPopoutId()` below, not a bare department id — the popped-out window
// needs the customer id too (the nested PATCH route requires it, and there is no
// standalone GET /departments/{id}).
export type PopoutTextField = 'summary' | 'matchRemarks' | 'companyText' | 'departmentText'

// K5a: encodes/decodes the composite id `departmentText` travels under —
// `<customerId>:<departmentId>` — so ONE string still fits the existing
// `id: string | number` shape every other popout field uses (§11: no second
// identity shape). A malformed/legacy id decodes to nulls, which the popout page
// treats as "unknown record" (§3), never a silent wrong fetch.
export const departmentPopoutId = (customerId: string | number, departmentId: string | number): string =>
  `${customerId}:${departmentId}`
export const parseDepartmentPopoutId = (id: string | undefined): { customerId: string; departmentId: string } | null => {
  if (!id) return null
  const [customerId, departmentId] = id.split(':')
  return customerId && departmentId ? { customerId, departmentId } : null
}

// Identity of ONE popped-out field: the OS window name AND the BroadcastChannel
// topic the two windows sync their draft over (hooks/useTextPopoutSync). Scoped
// per entity+id+field so two records — or two fields of one record — never mirror
// each other's text.
export const textPopoutTopic = (entity: PopoutEntity, id: string | number, field: PopoutTextField) =>
  `koios-text-${entity}-${id}-${field}`

// Opens (or re-focuses) the second-screen editor for one free-text field. Returns
// null when the browser blocked the popup — the caller surfaces `common:popupBlocked`.
export function openTextPopout(entity: PopoutEntity, id: string | number, field: PopoutTextField): Window | null {
  return window.open(`/popout/text/${entity}/${id}/${field}`, textPopoutTopic(entity, id, field), popupFeatures())
}
