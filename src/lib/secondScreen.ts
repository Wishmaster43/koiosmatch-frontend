/**
 * secondScreen — opens a standalone, id-driven page in a REAL separate browser
 * window (NOTITIE-POPOUT-1 F5, "Trap B" of NOTITIE-POPOUT-PLAN.md). A draggable
 * in-window panel (FloatingPanel, "Trap A") can never reach a second monitor —
 * the browser has no API to drag a DOM element outside its own window — so the
 * second-screen case needs an actual `window.open`. The httpOnly-cookie session,
 * theme and language all bootstrap automatically in the new window (same origin,
 * same session) — nothing extra to wire for auth/theming here.
 *
 * NAMED WINDOW: passing the same `windowName` on a second call re-focuses the
 * existing OS window instead of spawning a duplicate, so clicking "pop out" twice
 * on the same candidate never litters the desktop with two windows fighting over
 * one note thread.
 */

// One popup-window feature string for every second-screen window this app opens —
// small, chrome-less, and resizable so the recruiter can still fit it beside
// whatever else is open on that monitor.
const POPUP_FEATURES = 'popup=yes,width=560,height=720'

// Opens (or focuses, if already open) the candidate notes popout. Returns the
// WindowProxy on success, or null when the browser blocked the popup — the
// caller decides how to surface that (a notify() warning, i18n key `common:popupBlocked`).
export function openNotesPopout(candidateId: string | number): Window | null {
  return window.open(`/popout/notes/${candidateId}`, `koios-notes-${candidateId}`, POPUP_FEATURES)
}
