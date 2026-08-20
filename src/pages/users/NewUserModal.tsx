/**
 * NewUserModal — create-user dialog (POST /users). Roles come from the live
 * central roles table (LOOKUP-GAP-1a — the old hardcoded ROLES literal rejected
 * custom tenant roles); picking one previews the branches the new user will
 * inherit (USERS-ROLES-LOC-1 role-template copy on create). Extracted from
 * UsersPage.
 */
import { useState, useEffect, useId } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
// G34: the house searchable dropdown replaces the native role <select>.
import CreatableSelect from '@/components/ui/CreatableSelect'
import Button from '@/components/ui/Button'
import type { ManagedUser } from '@/types/api'
import { useAssignableRoles } from './hooks/useAssignableRoles'
import { useRoleBranchTemplate } from './hooks/useRoleBranchTemplate'
import { useLocations } from '@/lib/useLocations'
import { notifyError, notifySuccess } from '@/lib/notify'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { roleLabel } from './usersParts'

// VALIDATIE-LIVE-1-rest: `email` is the only field here the backend validates
// with a shape rule (UserController's inline POST rules — `'email' =>
// 'required|email|unique:users,email'`), so this is the only live format gate.
const EMAIL_VALIDATORS = { email: isValidEmailFormat }
const EMAIL_ERROR_KEYS = { email: 'validation.emailFormat' }

// POST /users response envelope: the UserResource plus a top-level `agent` block
// the backend attaches only when it provisioned an AI agent for this user
// (AGENT-META-SETUP — recruiter/manager roles only, see AiAgentProvisioner).
interface CreateUserResponse {
  data: ManagedUser
  agent?: { created: boolean; meta_setup_required: boolean; notice: string } | null
}

export default function NewUserModal({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (user: ManagedUser) => void
}) {
  const { t } = useTranslation('users')
  const { roles, loading: rolesLoading } = useAssignableRoles()
  const [form, setForm]     = useState({ firstname: '', lastname: '', email: '', password: '', role: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  // AGENT-META-SETUP: "create an AI agent?" — default on, asked only for the two
  // roles the backend actually provisions an agent for (AiAgentProvisioner::AGENT_ROLES).
  const [createAgent, setCreateAgent] = useState(true)
  // VALIDATIE-LIVE-1-rest: live, on-blur/typing format check for email — own
  // sibling hook, same idiom as AddCandidateModal.
  const { markTouched, fieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t, EMAIL_VALIDATORS, EMAIL_ERROR_KEYS)

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

  // Case-insensitive match against the backend's role-name gate (AiAgentProvisioner
  // matches the raw role slug, not a label) — a custom tenant role never qualifies.
  const isAgentRole = /^(recruiter|manager)$/i.test(form.role)

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
  // The role picker is now the house CreatableSelect (string) => void — same
  // shape the native select's onChange already produced (e.target.value).
  const setRole = (v: string) => setForm(f => ({ ...f, role: v }))
  const roleLabelId = useId()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // VALIDATIE-LIVE-1-rest: block on a live format failure too — marks any
    // untouched-but-malformed field touched so its message renders.
    if (touchInvalidFields().length) return
    setSaving(true); setError(null)
    try {
      // The flag only means anything for a recruiter/manager — omit it for every
      // other role so an unrelated role never implies one (server default is true).
      const body = isAgentRole ? { ...form, create_agent: createAgent } : form
      const res = await api.post<CreateUserResponse>('/users', body)
      const created = unwrap<ManagedUser>(res)
      // Divergence from the role template → replace-set the chosen branches
      // (the server already copied the template on create; PUT overrides it).
      if (chosenBranches !== null) {
        try { await api.put(`/users/${created.id}/branches`, { location_ids: chosenBranches }) }
        catch { notifyError(t('branches.saveFailed')) }
      }
      // The backend echoes a top-level agent notice (Meta manual-steps still
      // needed) only when it actually provisioned one — surface it once here.
      if (res.data?.agent?.notice) notifySuccess(res.data.agent.notice)
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
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable
    // header, SE-resize, remembered position; same 420px footprint as before.
    <FloatingPanel open onClose={onClose} title={t('newUser')} ariaLabel={t('newUser')}
      persistKey="new-user" width={420} bodyStyle={{ padding: '20px 24px 24px' }}>
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
          {/* E-mail — VALIDATIE-LIVE-1-rest: blur marks it touched so a live
              format error renders inline instead of only bouncing back as a 422. */}
          <div style={{ marginBottom: 12 }} onBlur={() => markTouched('email')}>
            <label style={label}>{t('email')}</label>
            <input required type="email" value={form.email} onChange={set('email')} placeholder="jan@bedrijf.nl" aria-label={t('email')}
              style={{ ...input, ...(fieldMessage('email') ? { borderColor: 'var(--color-danger)' } : {}) }} />
            {fieldMessage('email') && <p style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 5 }}>{fieldMessage('email')}</p>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{t('password')}</label>
            <input required type="password" value={form.password} onChange={set('password')} style={input} placeholder={t('pwPlaceholder')} aria-label={t('password')} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label id={roleLabelId} style={label}>{t('role')}</label>
            {/* Loading/empty is honest by having nothing to pick (§3 — no fake
                affordance), never a disabled attribute the shared component doesn't
                expose; the dimmed wrapper blocks interaction while there is nothing
                selectable yet, mirroring the old select's disabled look. */}
            <div style={(rolesLoading || roles.length === 0) ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
              <CreatableSelect value={form.role || null} onChange={setRole} allowCreate={false}
                aria-labelledby={roleLabelId}
                placeholder={rolesLoading ? t('rolesLoading') : (roles.length === 0 ? t('noRoles') : undefined)}
                options={roles.map(r => ({ value: r.name, label: roleLabel(t, r.name) }))}
                style={input} />
            </div>
          </div>

          {/* AGENT-META-SETUP: only asked for a recruiter/manager — the two roles the
              backend actually provisions an AI agent for. Default on; unchecking sends
              create_agent: false so the recruiter can opt out per user. */}
          {isAgentRole && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--hover-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={createAgent} onChange={e => setCreateAgent(e.target.checked)}
                  aria-label={t('agent.label')} style={{ cursor: 'pointer' }} />
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', cursor: 'pointer' }}>{t('agent.label')}</label>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, marginLeft: 24 }}>{t('agent.hint')}</p>
            </div>
          )}

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

          {error && <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving || !form.role || hasFormatError}>
              {saving ? <><Spinner size={13} /> {t('creating')}</> : t('create')}
            </Button>
          </div>
        </form>
    </FloatingPanel>
  )
}
