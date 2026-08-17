/**
 * useUserPreference — a piece of UI state that survives a refresh via the
 * logged-in user's own `ui_preferences` JSON blob (PUT /auth/me). The
 * mechanism already existed on the backend (AuthController::updateMe accepts
 * `ui_preferences: sometimes|nullable|array`, and AuthPayloadService::formatUser
 * always returns it — even as `{}` — on login AND /auth/me) but had no real
 * frontend consumer until the candidate Background sub-tab sort (2026-08-17).
 *
 * READ — once, from what the app already has: /auth/me is fetched at boot and
 * lives on AuthContext's `user`, so the initial value comes from THAT, never an
 * extra request on mount (a component that mounts/unmounts per drawer-open,
 * e.g. every Background sub-tab, must not re-fetch the profile every time).
 *
 * WRITE — a preference, not a document: the local value applies immediately
 * and NEVER reverts on a failed save (losing the user's current choice because
 * one background PATCH failed would be worse than not saving it at all — the
 * choice simply stays local for the rest of the session). The full
 * `ui_preferences` object is merged client-side before every write, because
 * the backend REPLACES the whole column on PUT /auth/me rather than deep-
 * merging it — so one feature's key must never clobber another's.
 */
import { useCallback, useState } from 'react'
import api from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export function useUserPreference<T>(key: string, fallback: T): [T, (next: T) => void] {
  const auth = useAuth()
  const user = auth?.user

  // Lazy initializer: runs once, off whatever /auth/me already delivered.
  const [value, setValue] = useState<T>(() => {
    const stored = (user?.ui_preferences as Record<string, unknown> | null | undefined)?.[key]
    return stored === undefined ? fallback : (stored as T)
  })

  const update = useCallback((next: T) => {
    // Optimistic + final: the UI never waits on the network, and a rejection
    // below does not undo this — see the file header.
    setValue(next)
    const merged = { ...((user?.ui_preferences as Record<string, unknown> | null | undefined) ?? {}), [key]: next }
    api.put('/auth/me', { ui_preferences: merged })
      .then(() => auth?.refreshUser?.())
      .catch(() => { /* fail quiet — `value` above already carries the pick for this session */ })
  }, [auth, user, key])

  return [value, update]
}
