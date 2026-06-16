/**
 * usePageSize — resolves the user's preferred table page size.
 * Reads the saved preference from the logged-in user; falls back to 500.
 */
import { useAuth } from '../context/AuthContext'

export const DEFAULT_PAGE_SIZE = 500

// Reads the saved page-size preference of the logged-in user.
// Fallback: 500 when the field does not exist.
export function useDefaultPageSize() {
  const { user } = useAuth()
  return Number(user?.default_per_page) || DEFAULT_PAGE_SIZE
}
