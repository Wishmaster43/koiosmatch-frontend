// Candidate-facing message languages — mirrors the backend's single constant
// (CMBE3 contract) so the workflow config.translations editor offers exactly
// the languages the send-engine understands.
export const MESSAGING_LANGUAGES = ['nl', 'en', 'de', 'fr', 'es', 'pl', 'ro'] as const

export type MessagingLanguage = (typeof MESSAGING_LANGUAGES)[number]

// The backend's default for candidate_messaging_language_default (used when the setting is unset).
export const DEFAULT_MESSAGING_LANGUAGE = 'nl'
