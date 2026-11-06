/**
 * useLeadFormOwners (LEAD-FORM-OWNER-FE-1) — loads and saves the per-form owner map of the
 * Facebook lead forms (GET/PUT /facebook-leads/form-owners). The PUT replaces the WHOLE map.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { apiErrorMessage } from '@/lib/extractApiError'

// Hand-written (the spec carries no schema for these routes): the unwrapped body is {"owners":{"<formId>":"<userId>"|null}}.
interface OwnersBody { owners?: Record<string, string | null> }
export interface FormOwnerRow { formId: string; ownerId: string | null }

// Server map to ordered rows.
const toRows = (res: unknown): FormOwnerRow[] =>
  Object.entries(unwrap<OwnersBody>(res as Parameters<typeof unwrap>[0])?.owners ?? {}).map(([formId, ownerId]) => ({ formId, ownerId: ownerId ?? null }))

// Stable comparison key of the rows, used for the dirty flag.
const signature = (rows: FormOwnerRow[]) => JSON.stringify(rows)

export function useLeadFormOwners() {
  const { t } = useTranslation('settings')
  const [rows, setRows] = useState<FormOwnerRow[]>([])
  const [baseline, setBaseline] = useState('[]')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load the stored map on mount and on retry; the alive guard drops a stale response.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    Promise.resolve().then(() => api.get('/facebook-leads/form-owners')).then((res) => {
      if (!alive) return
      const next = toRows(res)
      setRows(next)
      setBaseline(signature(next))
    }).catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reloadKey])

  // Re-run the load effect (the retry button).
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  // The saved flash timer, cleared on unmount so no state is set after it.
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current) }, [])

  // Set or clear (null) the owner of one form.
  const setOwner = (formId: string, ownerId: string | null) =>
    setRows((prev) => prev.map((r) => (r.formId === formId ? { ...r, ownerId } : r)))

  // Add a form id; returns false (nothing changed) for a non-numeric or duplicate id.
  const addForm = (rawId: string): boolean => {
    const formId = rawId.trim()
    if (!/^\d+$/.test(formId) || rows.some((r) => r.formId === formId)) return false
    setRows((prev) => [...prev, { formId, ownerId: null }])
    return true
  }

  // Drop a form row; the next save removes it from the server map.
  const removeForm = (formId: string) => setRows((prev) => prev.filter((r) => r.formId !== formId))

  // PUT the whole map; on success the answered map becomes the new baseline.
  const save = async () => {
    setSaving(true)
    const owners: Record<string, string | null> = {}
    rows.forEach((r) => { owners[r.formId] = r.ownerId ?? null })
    try {
      const res = await api.put('/facebook-leads/form-owners', { owners })
      const next = toRows(res)
      setRows(next)
      setBaseline(signature(next))
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      notifyError(apiErrorMessage(err, t, t('facebookLeads.formOwners.saveError')))
    } finally {
      setSaving(false)
    }
  }

  return { rows, loading, loadError, reload, setOwner, addForm, removeForm, dirty: signature(rows) !== baseline, save, saving, saved }
}
