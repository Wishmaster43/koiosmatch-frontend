/**
 * avatarColor — shared entity-avatar colour cycle + a stable per-string picker.
 * Single source for the ShiftManager department/contact/location avatar helpers
 * (was the same array + `ac()` duplicated 3×). Re-exports the Avatar component's
 * own palette (was a separate 6-colour array vs. Avatar's 7 — two palettes meant
 * the same name could hash to a different colour in a table vs. a drawer header)
 * so every avatar in the app — candidate, owner, ShiftManager entity — hashes the
 * same label to the same colour.
 */
import { AVATAR_COLORS } from '@/components/ui/Avatar'

export { AVATAR_COLORS }

// Deterministic avatar colour from the first character of the label.
export const avatarColor = (s?: string) => AVATAR_COLORS[(s || '?').charCodeAt(0) % AVATAR_COLORS.length]
