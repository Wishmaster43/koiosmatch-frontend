/**
 * Pure mappers for VacancyGenerationProfile — converts between the frontend's
 * nested draft structure (matcher { location_ids, contract_types, ... } +
 * content { template, tone_of_voice, ... }) and the backend's nested envelope
 * shape (POST/PUT sends {name, is_default, priority, matcher:{...}, content:{...}}).
 * On GET, the API mirrors both flat and nested keys for backward compatibility;
 * the FE reads nested when present, falls back to flat keys for older profiles.
 */

// Defaults for a fresh profile draft — used by fromApiProfile to backfill
// missing keys when a profile predates newer fields.
const emptyDraft = () => ({
  name: '',
  is_default: false,
  priority: 10,
  matcher: { location_ids: [], contract_types: [], function_titles: [], industries: [] },
  content: {
    template: '',
    tone_of_voice: 'neutral',
    length: 'medium',
    language: '',
    allow_emoji: false,
    brand_instructions: '',
    forbidden_words: [],
    content_block_ids: [],
  },
})

/**
 * Send a nested envelope to the API on POST/PUT.
 * The nested shape is {name, is_default, priority, matcher:{...}, content:{...}},
 * never a mix of flat and nested keys.
 */
export const toApiProfile = (draft) => {
  const empty = emptyDraft()
  return {
    name: draft.name ?? empty.name,
    is_default: draft.is_default ?? empty.is_default,
    priority: draft.priority ?? empty.priority,
    matcher: {
      location_ids: draft.matcher?.location_ids ?? empty.matcher.location_ids,
      contract_types: draft.matcher?.contract_types ?? empty.matcher.contract_types,
      function_titles: draft.matcher?.function_titles ?? empty.matcher.function_titles,
      industries: draft.matcher?.industries ?? empty.matcher.industries,
    },
    content: {
      template: draft.content?.template ?? empty.content.template,
      tone_of_voice: draft.content?.tone_of_voice ?? empty.content.tone_of_voice,
      length: draft.content?.length ?? empty.content.length,
      language: draft.content?.language ?? empty.content.language,
      allow_emoji: draft.content?.allow_emoji ?? empty.content.allow_emoji,
      brand_instructions: draft.content?.brand_instructions ?? empty.content.brand_instructions,
      forbidden_words: draft.content?.forbidden_words ?? empty.content.forbidden_words,
      content_block_ids: draft.content?.content_block_ids ?? empty.content.content_block_ids,
    },
  }
}

/**
 * Read a profile from the API and nest it into the editor's draft structure.
 * The API returns both flat keys (for backward compat) and nested matcher/content.
 * Read the nested shape if present; fall back to flat keys for older profiles.
 * Backfill missing keys from emptyDraft defaults.
 */
export const fromApiProfile = (profile) => {
  const empty = emptyDraft()

  // Read matcher from the nested shape if present; otherwise extract from flat keys.
  const matcher = profile.matcher ?? {
    location_ids: profile.location_ids ?? empty.matcher.location_ids,
    contract_types: profile.contract_types ?? empty.matcher.contract_types,
    function_titles: profile.function_titles ?? empty.matcher.function_titles,
    industries: profile.industries ?? empty.matcher.industries,
  }

  // Read content from the nested shape if present; otherwise extract from flat keys.
  const content = profile.content ?? {
    template: profile.template ?? empty.content.template,
    tone_of_voice: profile.tone_of_voice ?? empty.content.tone_of_voice,
    length: profile.length ?? empty.content.length,
    language: profile.language ?? empty.content.language,
    allow_emoji: !!profile.allow_emoji,
    brand_instructions: profile.brand_instructions ?? empty.content.brand_instructions,
    forbidden_words: profile.forbidden_words ?? empty.content.forbidden_words,
    content_block_ids: profile.content_block_ids ?? empty.content.content_block_ids,
  }

  return {
    name: profile.name ?? empty.name,
    is_default: !!profile.is_default,
    priority: profile.priority ?? empty.priority,
    matcher,
    content,
  }
}
