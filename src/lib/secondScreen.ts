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

// One popup-window feature string for every second-screen window this app opens —
// small, chrome-less, and resizable so the recruiter can still fit it beside
// whatever else is open on that monitor.
const POPUP_FEATURES = 'popup=yes,width=560,height=720'

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
  return window.open(`/popout/notes/${entity}/${id}`, `koios-notes-${entity}-${id}`, POPUP_FEATURES)
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
 * TEKST-POPOUT-1 (Danny 08-08, punt 2): the SAME second-screen mechanism for a
 * single free-text field — today the candidate's profile text. Notes pop out a
 * whole thread; this pops out ONE field so the recruiter can write it full-size
 * on a second monitor while the drill-down stays where it was. Deliberately the
 * same `window.open` + named-window recipe as openNotesPopout above (§11: one
 * mechanism, never a second implementation) — only the route differs.
 */
// The free-text fields that own a second-screen editor. One entry per field the
// route dispatcher (pages/popout/TextPopoutPage.tsx) knows how to render.
export type PopoutTextField = 'summary'

// Identity of ONE popped-out field: the OS window name AND the BroadcastChannel
// topic the two windows sync their draft over (hooks/useTextPopoutSync). Scoped
// per entity+id+field so two records — or two fields of one record — never mirror
// each other's text.
export const textPopoutTopic = (entity: PopoutEntity, id: string | number, field: PopoutTextField) =>
  `koios-text-${entity}-${id}-${field}`

// Opens (or re-focuses) the second-screen editor for one free-text field. Returns
// null when the browser blocked the popup — the caller surfaces `common:popupBlocked`.
export function openTextPopout(entity: PopoutEntity, id: string | number, field: PopoutTextField): Window | null {
  return window.open(`/popout/text/${entity}/${id}/${field}`, textPopoutTopic(entity, id, field), POPUP_FEATURES)
}
