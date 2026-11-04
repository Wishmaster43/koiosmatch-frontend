// ONIX L-008: ONE list of the browser-side keys bound to an authenticated session.
// Both logout paths (explicit logout, 401 / session-gone) clear them together.

// Fixed keys that must not outlive a session.
const SESSION_KEYS = ['auth_token', 'auth_user', 'active_tenant', 'accessible_pages', 'km_session'] as const

// Session-scoped flags that re-arm with the next session. Only the MFA-gate signal belongs here: the
// api client raises it once per session (B-23) and both session ends must let it fire again. The
// login-screen explanations (km_session_expired, session revoked, no organisation) are NOT listed: the
// 401 path writes them right AFTER this clear so the login page can still read them.
const SESSION_STORAGE_KEYS = ['km_mfa_gate'] as const

// Prefix of the per-workflow graph copies (steps hold message texts and recipients).
const WORKFLOW_GRAPH_PREFIX = 'wf_graph_'

// Removes the session keys, the session-scoped flags and every wf_graph_* copy; unrelated keys stay.
export function clearDeviceCaches(): void {
  try {
    SESSION_KEYS.forEach(k => localStorage.removeItem(k))
    SESSION_STORAGE_KEYS.forEach(k => sessionStorage.removeItem(k))
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(WORKFLOW_GRAPH_PREFIX)) stale.push(key)
    }
    stale.forEach(k => localStorage.removeItem(k))
  } catch { /* storage unavailable: nothing to clear */ }
}
