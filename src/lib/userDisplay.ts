/**
 * userDisplay — shared user name rendering helper.
 */
import type { Id } from '@/types/common'

export interface UserLike {
  id?: Id
  name?: string
  firstname?: string
  lastname?: string
  email?: string
  avatar_color?: string | null
}

/**
 * Render a user name from a UserLike shape, tolerant of the shapes /users returns.
 * Falls back to an em dash (the three former local copies all did) unless told otherwise.
 */
export function userName(u: UserLike | null | undefined, fallback = '—'): string {
  if (!u) return fallback
  return u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || fallback
}
