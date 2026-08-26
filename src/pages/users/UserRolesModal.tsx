/**
 * UserRolesModal — assign a user's roles through the ONE writing route for it:
 * `PUT /users/{id}/roles`.
 *
 * Measured live 09-08 (koiosmatch-api, yesway): the body is
 * `{"roles":[<id|name>, …]}` and it REPLACES the full set (Spatie syncRoles) —
 * sending `[5,7]` returned both roles, sending `["manager"]` afterwards left only
 * manager. We send the role IDs exactly as `/roles` delivered them, so the
 * request never depends on a display label. `roles` is `required|array|min:1`
 * server-side, hence saving an empty set is blocked here too (no fake affordance).
 *
 * Multi-select is searchable by house rule (never a native select): the shared
 * SearchSelect provides the search + checklist; the current set renders as soft
 * role chips with a real remove button each.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
import SearchSelect from '@/components/ui/SearchSelect'
import { extractApiError } from '@/lib/extractApiError'
import Button from '@/components/ui/Button'
import type { ManagedUser } from '@/types/api'
import { RoleBadge, roleLabel, roleName } from './usersParts'
import type { AvailableRole } from './usersParts'

// The role-assignment modal: a full-set replace via PUT /users/{id}/roles, never a saveable empty set.
export default function UserRolesModal({ user, roles, onSaved, onClose }: {
  user: ManagedUser
  // Assignable roles from GET /roles (super_admin/tenant_admin already filtered out).
  roles: AvailableRole[]
  onSaved: (updated: ManagedUser) => void
  onClose: () => void
}) {
  const { t } = useTranslation('users')
  // Selection is held as the string form of each role id (SearchSelect option
  // values are strings); the original id is looked back up on save.
  const [selected, setSelected] = useState<string[]>(() => {
    const currentNames = new Set((user.roles ?? []).map(roleName).filter(Boolean))
    return roles.filter(r => currentNames.has(r.name)).map(r => String(r.id))
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = (value: string) =>
    setSelected(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  // Send the ids in their ORIGINAL type (numbers from /roles), not the stringified
  // selection — the measured contract takes ids, and this keeps the body identical
  // to what the API returned.
  const save = async () => {
    setSaving(true); setError(null)
    try {
      const ids = roles.filter(r => selected.includes(String(r.id))).map(r => r.id)
      const res = await api.put(`/users/${user.id}/roles`, { roles: ids })
      onSaved(unwrap<ManagedUser>(res))
      onClose()
    } catch (err) {
      setError(extractApiError(err, t('changeRoleFailed')))
    } finally {
      setSaving(false)
    }
  }

  const chosen = roles.filter(r => selected.includes(String(r.id)))

  return (
    <FloatingPanel open onClose={onClose} title={t('rolesModal.title')} ariaLabel={t('rolesModal.title')}
      persistKey="user-roles" width={400} bodyStyle={{ padding: '20px 24px 24px' }}>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        {t('rolesModal.hint')}
      </p>

      {/* Current set — soft role chips, each removable (empty is honest, not hidden). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 14 }}>
        {chosen.length === 0 && (
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('rolesModal.none')}</span>
        )}
        {chosen.map(r => (
          <span key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <RoleBadge role={r.name} />
            {/* HUISSTIJL-1: left hand-styled — an 18px chip-remove glyph sized to sit
                inside the role-chip row; Button's smallest footprint (28px) would break it. */}
            <button type="button" onClick={() => toggle(String(r.id))}
              aria-label={t('rolesModal.remove', { role: roleLabel(t, r.name) })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
                       borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)',
                       color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={10} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>

      {/* Adding is a real button (§ house rule), opening the searchable checklist. */}
      <div style={{ marginBottom: 18 }}>
        <SearchSelect options={roles.map(r => ({ value: String(r.id), label: roleLabel(t, r.name) }))}
          selected={selected} onToggle={toggle}
          renderTrigger={open => (
            <Button variant="soft" onClick={open}>
              <Plus size={13} aria-hidden="true" /> {t('rolesModal.add')}
            </Button>
          )} />
      </div>

      {error && <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>
          {t('common:cancel')}
        </Button>
        {/* Disabled on an empty set: the route rejects `roles: []` (min:1), so an
            enabled button there would be a promise the API cannot keep. */}
        <Button variant="primary" onClick={save} disabled={saving || selected.length === 0}>
          {saving && <Spinner size={13} />}
          {t('common:save')}
        </Button>
      </div>
    </FloatingPanel>
  )
}
