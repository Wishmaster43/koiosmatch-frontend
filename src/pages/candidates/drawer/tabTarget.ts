// Deep-link target parsing (shared contract): the candidates table produces a
// "<drawerTabId>", "<drawerTabId>:<subTabId>" or "<drawerTabId>:<subTabId>:<action>"
// string on a value cell click or a Koios suggestion (e.g. 'work:matches',
// 'communication:notes', 'communication:conversations:start'); CandidateDrawer
// consumes it to open the matching tab/sub-tab/action. Pure — no React import.
export interface TabTarget {
  tab: string
  sub?: string
  action?: string
}

// Split into at most THREE segments on ':' (tab, sub, action) — a third segment
// signals an action to perform once the sub-tab has opened (CONVERSATION-START-1).
// Empty/null/undefined => no target (null).
export function parseTabTarget(target?: string | null): TabTarget | null {
  if (!target) return null
  const parts = target.split(':')
  if (parts.length <= 1) return { tab: parts[0] }
  if (parts.length === 2) return { tab: parts[0], sub: parts[1] }
  // Extra colons beyond the third segment fold back into `action`, so an action
  // id containing ':' (none today) never gets mangled — mirrors the old
  // first-colon-only split's "never mangle" guarantee.
  return { tab: parts[0], sub: parts[1], action: parts.slice(2).join(':') }
}
