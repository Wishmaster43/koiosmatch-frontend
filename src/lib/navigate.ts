/**
 * navigate — cross-component page navigation for the hash-based app shell.
 * Mirrors DashboardLayout.goTo (pushState + a popstate dispatch) so a deep leaf
 * component can jump to another page without prop-drilling a callback, while the
 * browser's back/forward keep working (the layout listens on `popstate`).
 */

// Navigate to a top-level page id (e.g. 'shiftmanager.candidates').
export function navigateToPage(page: string) {
  window.history.pushState({ kmPage: page }, '', `#${page}`)
  window.dispatchEvent(new PopStateEvent('popstate', { state: { kmPage: page } }))
}
