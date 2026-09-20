/**
 * composerEmoji — WA-COMPOSER-1: the curated emoji set for the WhatsApp
 * composer's emoji panel, grouped so the panel can render short labelled
 * rows rather than one undifferentiated grid.
 */

// Three short groups: smileys, gestures, objects — kept small and curated
// rather than a full emoji-library dependency, per the brief.
export const COMPOSER_EMOJI: { group: string; emoji: string[] }[] = [
  { group: 'smileys', emoji: ['😀', '😊', '😉', '😅', '😂', '🙂', '😍', '🤔', '😢', '😮', '👏', '🙏', '😴', '😎', '🥳', '😇'] },
  { group: 'gestures', emoji: ['👍', '👎', '👌', '✌️', '🤞', '🤝', '👋', '💪', '☝️', '✅', '❌', '🙌', '🤲', '👊', '🤙', '🫡'] },
  { group: 'objects', emoji: ['📅', '📞', '💬', '📎', '📌', '⏰', '📄', '✉️', '🚗', '🏠', '💼', '⭐', '❤️', '🎉', '🔔', '📍'] },
]
