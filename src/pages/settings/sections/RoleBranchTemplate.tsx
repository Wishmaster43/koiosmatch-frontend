/**
 * RoleBranchTemplate — one role's branch TEMPLATE: the starting set new users
 * with this role inherit (USERS-ROLES-LOC-1 / BranchAssignmentController::
 * roleBranches). Existing users keep their own set once created; this only
 * edits the template row. Rendered inside RoleDetail.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import Spinner from '@/components/ui/Spinner'
import { useLocations } from '@/lib/useLocations'
import type { Role, UpdateBranchesBody } from './rolesTypes'

// Edits one role's branch TEMPLATE only; existing users keep whatever set they already have, this never retroactively changes their branches (see file header).
export function RoleBranchTemplate({ roleId }: { roleId: Role['id'] }) {
  const { t } = useTranslation('settings')
  const locationOptions = useLocations()
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  // Blocks the toggle path while true — never build a destructive replace-set PUT from an empty branchIds[] that only reads empty because the load itself failed (§9).
  const [loadError, setLoadError] = useState(false)

  // Load the role's current template whenever the open role changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    api.get(`/roles/${roleId}/branches`)
      .then(r => { if (!cancelled) setBranchIds(unwrapList<{ location_id: string | number }>(r).rows.map(b => String(b.location_id))) })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [roleId])

  // Shared optimistic replace-set PUT: set the new list first, revert + notify on
  // failure. Both toggle() (one value) and setMany() (select-all/clear-all) only
  // differ in how they compute `next` — the persist/revert dance is identical.
  const putBranches = async (next: string[]) => {
    const prev = branchIds
    setBranchIds(next)
    setSaving(true)
    try {
      await api.put(`/roles/${roleId}/branches`, { location_ids: next } satisfies UpdateBranchesBody)
    } catch {
      setBranchIds(prev)
      notifyError(t('roles.branchesSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // Toggle one branch — optimistic PUT (replace-set), revert + notify on failure.
  const toggle = async (locationId: string) => {
    if (loadError) return // the current set is unknown, never PUT a replace-set built on it
    const next = branchIds.includes(locationId) ? branchIds.filter(id => id !== locationId) : [...branchIds, locationId]
    await putBranches(next)
  }

  // Select-all / clear-all: ONE replace-set PUT for the whole batch (the per-value
  // toggle above would fire N racing PUTs; USERS-SELECTALL root fix, ChipMultiSelect.onSelectAll).
  const setMany = async (ids: string[], on: boolean) => {
    if (loadError) return
    const next = on ? Array.from(new Set([...branchIds, ...ids])) : branchIds.filter(id => !ids.includes(id))
    await putBranches(next)
  }

  return (
    <div style={{ marginBottom: 22, padding: '12px 16px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{t('roles.branchesTemplate')}</span>
        {saving && <span style={{ color: 'var(--text-muted)' }}><Spinner size={12} /></span>}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('roles.branchesTemplateHint')}</p>
      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>
      ) : loadError ? (
        <p style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('roles.branchesLoadError')}</p>
      ) : (
        // Locations are always UUID strings server-side; ChipMultiSelect's
        // ChipOption.value is typed as plain `string` (narrower than the
        // shared `Id` union useLocations returns) — normalise here (mirrors
        // EditUserModal's identical branch picker).
        <ChipMultiSelect options={locationOptions.map(o => ({ value: String(o.value), label: o.label }))}
          selected={branchIds} onToggle={toggle} onSelectAll={setMany} emptyText={t('roles.branchesNoLocations')} />
      )}
      {/* Honest empty-state note — an empty template does not restrict data today (branch-level
          authorization ships behind a tenant toggle, VESTIGING-1 fase 3, not yet enabled). */}
      {!loading && branchIds.length === 0 && locationOptions.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{t('roles.branchesEmptyHint')}</p>
      )}
    </div>
  )
}
