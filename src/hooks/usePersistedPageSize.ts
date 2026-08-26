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

// Server cap shared by the report-table endpoints (per_page between 1 and 200) —
// the raw stored preference can be 500, which 422s (seam harness, 05-08).
const SERVER_CAP = 200

// Page-size state clamped to the server cap on read, persisting a change as the user's default; the local size still applies even if the PUT fails.
export function usePersistedPageSize(serverCap: number = SERVER_CAP) {
  const defaultPageSize = useDefaultPageSize()
  const { refreshUser } = useAuth() ?? {}
  // Clamp on read: an over-cap stored preference must never reach the request.
  const [pageSize, setPageSize] = useState(Math.min(defaultPageSize, serverCap))

  // Persist the chosen size as the user's new default; local state applies regardless.
  const handlePageSizeChange = async (n: number) => {
    setPageSize(n)
    try { await api.put('/auth/me', { default_per_page: n }); await refreshUser?.() } catch { /* size still applies locally */ }
  }

  return { pageSize, setPageSize, handlePageSizeChange }
}
