// Deep-link target parsing (shared contract): the candidates table produces a
// "<drawerTabId>" or "<drawerTabId>:<subTabId>" string on a value cell click
// (e.g. 'work:matches', 'communication:notes'); CandidateDrawer consumes it to
// open the matching tab/sub-tab. Pure — no React import.
export interface TabTarget {
  tab: string
  sub?: string
}

// Split on the FIRST ':' only, so a sub-tab id containing ':' (none today, but
// kept safe) never gets mangled. Empty/null/undefined => no target (null).
export function parseTabTarget(target?: string | null): TabTarget | null {
  if (!target) return null
  const idx = target.indexOf(':')
  if (idx === -1) return { tab: target }
  return { tab: target.slice(0, idx), sub: target.slice(idx + 1) }
}
