/**
 * userRow — the shared row shape + pure helpers for the users surface, kept out
 * of the components so the table, the page and the dialogs all read one truth
 * (and so no file mixes component and helper exports).
 */
import type { ManagedUser } from '@/types/api'

/**
 * `deleted_at` / `last_login_at` are typed here by hand and read TOLERANTLY:
 * UserResource carries neither today (measured 09-08 against koiosmatch-api), and
 * the generated OpenAPI spec documents no 2xx schema for /users. Present ⇒ shown,
 * absent ⇒ the account reads as active and the last-login column does not render
 * at all (§3 — never a column suggesting data that is not there).
 */
export type UserRow = ManagedUser & {
  deleted_at?: string | null
  last_login_at?: string | null
  // C-004: a future value means the account is locked out after too many failed logins.
  login_locked_until?: string | null
}

// A user is archived only when the backend actually says so (soft-delete stamp).
export const isArchivedUser = (u: UserRow) => Boolean(u.deleted_at)

// Display name: "first last", falling back to the derived name, then the e-mail.
export const userDisplayName = (u: ManagedUser) =>
  [u.firstname, u.lastname].filter(Boolean).join(' ') || u.name || u.email || '—'

// C-004: true while login_locked_until parses to a moment in the future.
export const isLoginLocked = (u: UserRow) => {
  const until = u.login_locked_until ? new Date(u.login_locked_until).getTime() : NaN
  return Number.isFinite(until) && until > Date.now()
}
