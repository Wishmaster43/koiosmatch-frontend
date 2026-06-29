/**
 * avatarColor — shared entity-avatar colour cycle (design-token based) + a stable
 * per-string picker. Single source for the ShiftManager department/contact/location
 * avatar helpers (was the same array + `ac()` duplicated 3×). Hashing the first char
 * keeps a given label the same colour across its table and drawer.
 */
export const AVATAR_COLORS = [
  'var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)',
  'var(--color-warning)', 'var(--color-danger)', '#8B5CF6',
]

// Deterministic avatar colour from the first character of the label.
export const avatarColor = (s?: string) => AVATAR_COLORS[(s || '?').charCodeAt(0) % AVATAR_COLORS.length]
