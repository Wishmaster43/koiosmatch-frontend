/**
 * Pure mappers for VacancyGenerationProfile — converts between the frontend's
 * nested draft structure (matcher { location_ids, contract_types, ... } +
 * content { template, tone_of_voice, ... }) and the backend's flat validation
 * shape (all keys at the top level).
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
 * Flatten a nested draft to the API's flat validation shape.
 * Used on POST/PUT to send the correct request body.
 */
export const toApiProfile = (draft) => {
  const empty = emptyDraft()
  return {
    name: draft.name ?? empty.name,
    is_default: draft.is_default ?? empty.is_default,
    priority: draft.priority ?? empty.priority,
    // Matcher fields (flattened from draft.matcher)
    location_ids: draft.matcher?.location_ids ?? empty.matcher.location_ids,
    contract_types: draft.matcher?.contract_types ?? empty.matcher.contract_types,
    function_titles: draft.matcher?.function_titles ?? empty.matcher.function_titles,
    industries: draft.matcher?.industries ?? empty.matcher.industries,
    // Content fields (flattened from draft.content)
    template: draft.content?.template ?? empty.content.template,
    tone_of_voice: draft.content?.tone_of_voice ?? empty.content.tone_of_voice,
    length: draft.content?.length ?? empty.content.length,
    language: draft.content?.language ?? empty.content.language,
    allow_emoji: draft.content?.allow_emoji ?? empty.content.allow_emoji,
    brand_instructions: draft.content?.brand_instructions ?? empty.content.brand_instructions,
    forbidden_words: draft.content?.forbidden_words ?? empty.content.forbidden_words,
    content_block_ids: draft.content?.content_block_ids ?? empty.content.content_block_ids,
  }
}

/**
 * Nest a flat API profile into the editor's draft structure.
 * Used when loading a profile for editing, backfilling missing keys
 * from emptyDraft defaults (for profiles created before new fields existed).
 */
export const fromApiProfile = (profile) => {
  const empty = emptyDraft()
  return {
    name: profile.name ?? empty.name,
    is_default: !!profile.is_default,
    priority: profile.priority ?? empty.priority,
    matcher: {
      location_ids: profile.location_ids ?? empty.matcher.location_ids,
      contract_types: profile.contract_types ?? empty.matcher.contract_types,
      function_titles: profile.function_titles ?? empty.matcher.function_titles,
      industries: profile.industries ?? empty.matcher.industries,
    },
    content: {
      template: profile.template ?? empty.content.template,
      tone_of_voice: profile.tone_of_voice ?? empty.content.tone_of_voice,
      length: profile.length ?? empty.content.length,
      language: profile.language ?? empty.content.language,
      allow_emoji: !!profile.allow_emoji,
      brand_instructions: profile.brand_instructions ?? empty.content.brand_instructions,
      forbidden_words: profile.forbidden_words ?? empty.content.forbidden_words,
      content_block_ids: profile.content_block_ids ?? empty.content.content_block_ids,
    },
  }
}
