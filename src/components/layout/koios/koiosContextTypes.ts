/**
 * koiosContextTypes — the context-ref types the BACKEND can actually resolve
 * today (KOIOS-CTX-1). Mirrors `ContextRefResolver::TYPES`
 * (app/KoiosAi/Context/ContextRefResolver.php, koiosmatch-api) verbatim — fase 1
 * only accepts 'candidate'; every other @-mention category still gets a
 * client-side context chip (KOIOS-SEARCH-1) but is deliberately NOT sent in the
 * outgoing `context[]` array (koiosApi.sendChat), so picking e.g. a vacancy or a
 * task never trips the backend's strict 422 on an unknown type.
 *
 * BE extends `ContextRefResolver::TYPES` per entity as fase-1 lands (KOIOS-AGENT-
 * PLAN §7); the day a new token appears there, add it here in the SAME change —
 * one whitelist, kept in sync by code review, not by trusting the server to
 * silently accept more than this const advertises.
 */
export const RESOLVABLE_CONTEXT_TYPES: readonly string[] = ['candidate']

export function isContextResolvable(type: string): boolean {
  return RESOLVABLE_CONTEXT_TYPES.includes(type)
}
