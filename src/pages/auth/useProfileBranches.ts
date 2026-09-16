/**
 * useProfileBranches — load and set the logged-in user's default branch preference.
 * GET /profile/branches reads their accessible branches + current default_branch_id.
 * PUT /profile/default-branch {location_id} sets it or clears it (null).
 * On success, refreshes /auth/me so create-form prefills (useBranchDefault hooks) follow.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'

interface BranchOption {
  location_id: string
  name?: string
  can_view?: boolean
  can_update?: boolean
  can_delete?: boolean
  is_default?: boolean
}

interface ProfileBranchesResponse {
  data: BranchOption[]
  default_branch_id?: string | null
}

// Load + set the user's default branch preference.
export function useProfileBranches() {
  const { t } = useTranslation('auth')
  const { refreshUser } = useAuth() ?? {}
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [defaultBranchId, setDefaultBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Load and save failures are DIFFERENT states (verifier finding): a failed PUT
  // must never replace the working picker with a danger callout — only a failed
  // GET should hide the list. Kept as two fields so callers never conflate them.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load the user's branch list + current default once (on mount).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    api.get('/profile/branches')
      .then(res => {
        if (!cancelled) {
          const data = res.data as ProfileBranchesResponse
          setBranches(data.data ?? [])
          setDefaultBranchId(data.default_branch_id ?? null)
        }
      })
      .catch(err => {
        if (!cancelled) {
          // A failed LOAD is a load error, never the save wording.
          const message = extractApiError(err, t('common:error.loadFailed'))
          setLoadError(message)
          notifyError(message)
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  // Set the default branch; null clears it (promotes the first remaining).
  const setDefault = async (locationId: string | null) => {
    setSaving(true); setSaveError(null)
    try {
      const res = await api.put('/profile/default-branch', { location_id: locationId })
      const data = res.data as ProfileBranchesResponse
      setBranches(data.data ?? [])
      setDefaultBranchId(data.default_branch_id ?? null)
      // Refresh /auth/me so create-form prefills (useBranchDefault) pick up the change.
      await refreshUser?.()
      notifySuccess(t('profile.defaultBranchSaved'))
    } catch (err) {
      const msg = extractApiError(err, t('profile.defaultBranchSaveFailed'))
      setSaveError(msg)
      notifyError(msg)
    } finally {
      setSaving(false)
    }
  }

  return { branches, defaultBranchId, loading, saving, loadError, saveError, setDefault }
}
