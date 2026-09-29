/**
 * koiosContextTypes — the context-ref types the BACKEND can actually resolve
 * today (KOIOS-CTX-1). Mirrors `ContextRefResolver::TYPES`
 * (app/KoiosAi/Context/ContextRefResolver.php, koiosmatch-api) verbatim —
 * FIND-1 (BE api during-onix 66b2745a/4463bdbe) widened the whitelist to all 15
 * tokens the chat request's `context[].type` now accepts: candidate, application,
 * vacancy, match, customer, opportunity, location, customer_location, department,
 * contact, workflow, outreach_campaign, conversation, task, reference. Any other
 * @-mention category still gets a client-side context chip (KOIOS-SEARCH-1) but
 * is deliberately NOT sent in the outgoing `context[]` array (koiosApi.sendChat),
 * so picking an unresolvable type never trips the backend's strict 422 on an
 * unknown type.
 *
 * BE extends `ContextRefResolver::TYPES` per entity as fase-1 lands (KOIOS-AGENT-
 * PLAN §7); the day a new token appears there, add it here in the SAME change —
 * one whitelist, kept in sync by code review, not by trusting the server to
 * silently accept more than this const advertises.
 */
export const RESOLVABLE_CONTEXT_TYPES: readonly string[] = [
  'candidate', 'application', 'vacancy', 'match', 'customer', 'opportunity',
  'location', 'customer_location', 'department', 'contact', 'workflow',
  'outreach_campaign', 'conversation', 'task', 'reference',
]

// Whether an @-mention's context type is one the backend can actually resolve today.
export function isContextResolvable(type: string): boolean {
  return RESOLVABLE_CONTEXT_TYPES.includes(type)
}
