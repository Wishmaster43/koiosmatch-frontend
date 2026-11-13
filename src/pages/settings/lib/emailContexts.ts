/**
 * E-mail connection contexts. The screen and its stored settings keys use the
 * canonical English names (email_customers_*, email_candidates_*, email_planning_*);
 * the BE (EmailSettings::CONTEXTS) route segments, the test-mail body and the OAuth
 * callback still speak the Dutch tokens, while CatalogAliases already canonicalises
 * the KEYS. This map is the ONE place the Dutch wire words survive.
 * Removal trigger: SETTINGS-ALIAS-RETIRE-1 / X-47-BE (the BE accepts English route
 * segments); then delete this map and send canonical names.
 */
export type EmailContext = 'customers' | 'candidates' | 'planning'

// The contexts that have their own e-mail connection tab.
export const EMAIL_CONTEXTS: readonly EmailContext[] = ['customers', 'candidates', 'planning']

// Canonical English context -> the Dutch token the BE routes and callback use.
export const LEGACY_EMAIL_CONTEXT: Record<EmailContext, string> = {
  customers: 'klanten',
  candidates: 'kandidaten',
  planning: 'planning',
}

// Reverse lookup: Dutch wire token -> canonical English context.
const CANONICAL_BY_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_EMAIL_CONTEXT).map(([canonical, legacy]) => [legacy, canonical]),
)

/** Map a canonical context to the Dutch wire token; an unknown value passes through. */
export function toLegacyEmailContext(context: string): string {
  return LEGACY_EMAIL_CONTEXT[context as EmailContext] ?? context
}

/** Map a Dutch wire token (or an already canonical name) to the canonical context; unknown passes through. */
export function toCanonicalEmailContext(context: string): string {
  return CANONICAL_BY_LEGACY[context] ?? context
}
