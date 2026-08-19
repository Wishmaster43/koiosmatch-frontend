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

export function RoleBranchTemplate({ roleId }: { roleId: Role['id'] }) {
  const { t } = useTranslation('settings')
  const locationOptions = useLocations()
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  // Load the role's current template whenever the open role changes.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/roles/${roleId}/branches`)
      .then(r => { if (!cancelled) setBranchIds(unwrapList<{ location_id: string | number }>(r).rows.map(b => String(b.location_id))) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [roleId])

  // Toggle one branch — optimistic PUT (replace-set), revert + notify on failure.
  const toggle = async (locationId: string) => {
    const prev = branchIds
    const next = prev.includes(locationId) ? prev.filter(id => id !== locationId) : [...prev, locationId]
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
      ) : (
        // Locations are always UUID strings server-side; ChipMultiSelect's
        // ChipOption.value is typed as plain `string` (narrower than the
        // shared `Id` union useLocations returns) — normalise here (mirrors
        // EditUserModal's identical branch picker).
        <ChipMultiSelect options={locationOptions.map(o => ({ value: String(o.value), label: o.label }))}
          selected={branchIds} onToggle={toggle} emptyText={t('roles.branchesNoLocations')} />
      )}
      {/* Honest empty-state note — an empty template does not restrict data today (branch-level
          authorization ships behind a tenant toggle, VESTIGING-1 fase 3, not yet enabled). */}
      {!loading && branchIds.length === 0 && locationOptions.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{t('roles.branchesEmptyHint')}</p>
      )}
    </div>
  )
}
