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
