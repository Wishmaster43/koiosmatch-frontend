/**
 * requiredFieldKeys — folds the required-field keys a tenant stored onto the candidate
 * COLUMN keys the backend guard reads. Older versions of the settings screen wrote the API
 * response names (postal_code, linkedin, summary); the guard reads the model, so those
 * would match NULL forever. Shared by the settings catalogue and the create modal (lib,
 * not a cross-page import — CLAUDE.md §2).
 */
export const LEGACY_FIELD_KEY_ALIASES: Record<string, string> = {
  postal_code: 'postcode',
  linkedin: 'linkedin_slug',
  summary: 'description',
}

// Rewrites a stored list onto readable keys: aliases fold, duplicates collapse, unknown
// keys stay (a key this map does not know may be a valid attribute a later release adds).
export function normalizeRequiredFieldKeys(keys: readonly string[]): string[] {
  const out: string[] = []
  for (const k of keys) {
    const mapped = LEGACY_FIELD_KEY_ALIASES[k] ?? k
    if (!out.includes(mapped)) out.push(mapped)
  }
  return out
}
