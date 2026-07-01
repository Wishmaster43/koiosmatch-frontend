/**
 * usePersistedPageSize — page-size state that persists the chosen size as the user's
 * default (PUT /auth/me) and refreshes the session. Removes the repeated inline
 * api.put across the report tables (§3 + DUP). Non-blocking: the size still applies
 * locally if the save fails.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { useDefaultPageSize } from '@/lib/usePageSize'
import { useAuth } from '@/context/AuthContext'

export function usePersistedPageSize() {
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth() ?? {}
  const [pageSize, setPageSize] = useState(defaultPageSize)

  // Persist the chosen size as the user's new default; local state applies regardless.
  const handlePageSizeChange = async (n: number) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser?.() } catch { /* size still applies locally */ }
  }

  return { pageSize, setPageSize, handlePageSizeChange }
}
