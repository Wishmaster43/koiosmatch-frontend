/**
 * NewUserModal — create-user dialog (POST /users). Roles come from the live
 * central roles table (LOOKUP-GAP-1a — the old hardcoded ROLES literal rejected
 * custom tenant roles); picking one previews the branches the new user will
 * inherit (USERS-ROLES-LOC-1 role-template copy on create). Extracted from
 * UsersPage.
 */
import { useState, useEffect } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { BTN_H } from '@/config/buttonMetrics'
import type { ManagedUser } from '@/types/api'
import { useAssignableRoles } from './hooks/useAssignableRoles'
import { useRoleBranchTemplate } from './hooks/useRoleBranchTemplate'
import { useLocations } from '@/lib/useLocations'
import { notifyError } from '@/lib/notify'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { roleLabel } from './usersParts'

export default function NewUserModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (user: ManagedUser) => void
}) {
  const { t } = useTranslation('users')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { roles, loading: rolesLoading } = useAssignableRoles()
  const [form, setForm]     = useState({ firstname: '', lastname: '', email: '', password: '', role: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Seed the role select once the live list arrives — prefer "planner" (the old
  // default) if present, otherwise whatever the tenant's first assignable role is.
  useEffect(() => {
    if (form.role || roles.length === 0) return
    const preferred = roles.find(r => r.name === 'planner') ?? roles[0]
    setForm(f => (f.role ? f : { ...f, role: preferred.name }))
  }, [roles, form.role])

  // The picked role's id drives the branch-template seed below the select.
  const selectedRoleId = roles.find(r => r.name === form.role)?.id ?? null
  const { branches: templateBranches, loading: templateLoading } = useRoleBranchTemplate(selectedRoleId)

  // Danny ronde-2 punt 1.1: the branches are CHOOSABLE at creation (1 or more) —
  // the role template is only the seed. null = follow the template; a manual
  // toggle diverges; switching role snaps back to the new template.
  const locations = useLocations()
  const [chosenBranches, setChosenBranches] = useState<string[] | null>(null)
  useEffect(() => { setChosenBranches(null) }, [selectedRoleId])
  const effectiveBranches = chosenBranches ?? templateBranches.map(b => String(b.location_id))
  const toggleBranch = (id: string) =>
    setChosenBranches(effectiveBranches.includes(id) ? effectiveBranches.filter(x => x !== id) : [...effectiveBranches, id])

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await api.post('/users', form)
      const created = unwrap<ManagedUser>(res)
      // Divergence from the role template → replace-set the chosen branches
      // (the server already copied the template on create; PUT overrides it).
      if (chosenBranches !== null) {
        try { await api.put(`/users/${created.id}/branches`, { location_ids: chosenBranches }) }
        catch { notifyError(t('branches.saveFailed')) }
      }
      onCreated(created)
      onClose()
    } catch (err) {
      const e2 = err as { response?: { data?: { message?: string } } }
      setError(e2.response?.data?.message ?? t('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const input: CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--input-bg)',
                  color: 'var(--text)', outline: 'none' }
  const label: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5 }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('newUser')} tabIndex={-1}
        className="fixed z-50" style={{
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        width: 420, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('newUser')}</h3>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>{t('firstName')}</label>
              <input required value={form.firstname} onChange={set('firstname')} style={input} placeholder="Jan" aria-label={t('firstName')} />
            </div>
            <div>
              <label style={label}>{t('lastName')}</label>
              <input value={form.lastname} onChange={set('lastname')} style={input} placeholder="Jansen" aria-label={t('lastName')} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{t('email')}</label>
            <input required type="email" value={form.email} onChange={set('email')} style={input} placeholder="jan@bedrijf.nl" aria-label={t('email')} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{t('password')}</label>
            <input required type="password" value={form.password} onChange={set('password')} style={input} placeholder={t('pwPlaceholder')} aria-label={t('password')} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{t('role')}</label>
            <select required value={form.role} onChange={set('role')} aria-label={t('role')}
              disabled={rolesLoading || roles.length === 0}
              style={{ ...input, cursor: rolesLoading || roles.length === 0 ? 'default' : 'pointer' }}>
              {rolesLoading && <option value="">{t('rolesLoading')}</option>}
              {!rolesLoading && roles.length === 0 && <option value="">{t('noRoles')}</option>}
              {roles.map(r => <option key={r.id} value={r.name}>{roleLabel(t, r.name)}</option>)}
            </select>
          </div>

          {/* Vestigingen — seeded from the role template, adjustable before create
              (Danny ronde-2 punt 1.1: kies er 1 of meerdere bij het aanmaken). */}
          {form.role && (
            <div style={{ marginBottom: 20, padding: '10px 12px', borderRadius: 8, background: 'var(--hover-bg)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6,
                            textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('branches.previewTitle')}
              </div>
              {templateLoading ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('branches.loading')}</p>
              ) : (
                <ChipMultiSelect
                  options={locations.map(o => ({ value: String(o.value), label: o.label }))}
                  selected={effectiveBranches}
                  onToggle={toggleBranch}
                  emptyText={t('branches.noLocations')}
                />
              )}
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}

          {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                       background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {t('common:cancel')}
            </button>
            <button type="submit" disabled={saving || !form.role}
              style={{ height: BTN_H, padding: '0 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                       background: 'var(--color-primary)', color: 'white', cursor: saving ? 'default' : 'pointer',
                       display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {t('creating')}</> : t('create')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
