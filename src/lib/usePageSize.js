import { useAuth } from '../context/AuthContext'

export const DEFAULT_PAGE_SIZE = 500

// Leest de opgeslagen voorkeur van de ingelogde user.
// Fallback: 500 als het veld niet bestaat.
export function useDefaultPageSize() {
  const { user } = useAuth()
  return Number(user?.default_per_page) || DEFAULT_PAGE_SIZE
}
