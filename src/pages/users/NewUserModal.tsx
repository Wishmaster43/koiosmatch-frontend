/**
 * NewUserModal — create-user dialog (POST /users). Roles come from the live
 * central roles table (LOOKUP-GAP-1a — the old hardcoded ROLES literal rejected
 * custom tenant roles); picking one previews the branches the new user will
 * inherit (USERS-ROLES-LOC-1 role-template copy on create). Extracted from
 * UsersPage.
 */
import { useState, useEffect } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
// G34: the house searchable dropdown replaces the native role <select>.
import CreatableSelect from '@/components/ui/CreatableSelect'
import type { ManagedUser } from '@/types/api'
import { useAssignableRoles } from './hooks/useAssignableRoles'
import { useRoleBranchTemplate } from './hooks/useRoleBranchTemplate'
import { useLocations } from '@/lib/useLocations'
import { notifyError, notifySuccess } from '@/lib/notify'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { roleLabel } from './usersParts'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { Caption, GroupLabel } from '@/components/ui/typography'
// FIELD-LAYOUT canon (Danny 13-08): every field is a label-LEFT row from the
// shared form kit — mirrors AddCandidateModal's cards (src/pages/candidates/addmodal/).
import { FieldRow, TextField, CheckboxField } from '@/components/forms/fields'
import FieldNotice from '@/components/ui/FieldNotice'
import ModalErrorSubmitFooter from '@/components/forms/ModalErrorSubmitFooter'

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

// The new-user create form: role + branch assignment + optional AI agent
// provisioning for the roles the backend supports (see AGENT-META-SETUP above).
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
  // Switching role resets a manual branch pick back to following that role's own template.
  useEffect(() => { setChosenBranches(null) }, [selectedRoleId])
  const effectiveBranches = chosenBranches ?? templateBranches.map(b => String(b.location_id))
  const toggleBranch = (id: string) =>
    setChosenBranches(effectiveBranches.includes(id) ? effectiveBranches.filter(x => x !== id) : [...effectiveBranches, id])

  // Form-field setter: the kit's TextField reports the new VALUE directly, not
  // a ChangeEvent like a native onChange handler would.
  const set = (k: keyof typeof form) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }))
  // The role picker is now the house CreatableSelect (string) => void — same
  // shape the native select's onChange already produced (e.target.value).
  const setRole = (v: string) => setForm(f => ({ ...f, role: v }))

  // Creates the user, then (only on a manual branch divergence) replaces its
  // branch set, and surfaces any agent-provisioning notice the backend echoed.
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

  // Field faces come from fieldMetrics' canon (§4 2b) — never a local copy.
  const input: CSSProperties = fieldInputStyle

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable
    // header, SE-resize, remembered position; same 420px footprint as before.
    <FloatingPanel open onClose={onClose} title={t('newUser')} ariaLabel={t('newUser')}
      persistKey="new-user" width={420} bodyStyle={{ padding: '20px 24px 24px' }}>
        <form onSubmit={handleSubmit}>
          {/* Name row (FIELD-LAYOUT canon: label left of every field). */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FieldRow label={t('firstName')} required>
              <TextField value={form.firstname} onChange={set('firstname')} placeholder={t('common:placeholders.firstName')} />
            </FieldRow>
            <FieldRow label={t('lastName')}>
              <TextField value={form.lastname} onChange={set('lastname')} placeholder={t('common:placeholders.lastName')} />
            </FieldRow>
          </div>
          {/* E-mail — VALIDATIE-LIVE-1-rest: blur marks it touched so a live
              format error renders inline instead of only bouncing back as a 422. */}
          <div style={{ marginBottom: 12 }} onBlur={() => markTouched('email')}>
            <FieldRow label={t('email')} required>
              <TextField type="email" value={form.email} onChange={set('email')} placeholder={t('common:placeholders.emailExample')} error={!!fieldMessage('email')} />
            </FieldRow>
            <FieldNotice text={fieldMessage('email')} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <FieldRow label={t('password')} required>
              <TextField type="password" autoComplete="new-password" value={form.password} onChange={set('password')} placeholder={t('pwPlaceholder')} />
            </FieldRow>
          </div>
          <div style={{ marginBottom: 12 }}>
            {/* ROLE-PICKER-LEFT-1: the shared FieldRow, like every sibling field
                (§3A field-layout canon) — no private restyle. Not `required`:
                nothing here validates the role as required (the create button is
                merely disabled without one, no aria-required existed before this
                row was hand-rolled). Loading/empty is honest by having nothing to
                pick (§3 — no fake affordance); the dimmed style blocks interaction
                while there is nothing selectable yet, mirroring the old select's
                disabled look. */}
            <FieldRow label={t('role')}>
              <CreatableSelect value={form.role || null} onChange={setRole} allowCreate={false}
                placeholder={rolesLoading ? t('rolesLoading') : (roles.length === 0 ? t('noRoles') : undefined)}
                options={roles.map(r => ({ value: r.name, label: roleLabel(t, r.name) }))}
                style={(rolesLoading || roles.length === 0) ? { ...input, opacity: 0.6, pointerEvents: 'none' } : input} />
            </FieldRow>
          </div>

          {/* AGENT-META-SETUP: only asked for a recruiter/manager — the two roles the
              backend actually provisions an AI agent for. Default on; unchecking sends
              create_agent: false so the recruiter can opt out per user. */}
          {isAgentRole && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--hover-bg)' }}>
              <FieldRow label={t('agent.label')}>
                <CheckboxField checked={createAgent} onChange={setCreateAgent} />
              </FieldRow>
              <Caption as="p" style={{ marginTop: 6 }}>{t('agent.hint')}</Caption>
            </div>
          )}

          {/* Vestigingen — seeded from the role template, adjustable before create
              (Danny ronde-2 punt 1.1: kies er 1 of meerdere bij het aanmaken). */}
          {form.role && (
            <div style={{ marginBottom: 20, padding: '10px 12px', borderRadius: 8, background: 'var(--hover-bg)' }}>
              <GroupLabel style={{ marginBottom: 6 }}>
                {t('branches.previewTitle')}
              </GroupLabel>
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

          <ModalErrorSubmitFooter
            error={error}
            onCancel={onClose}
            cancelLabel={t('common:cancel')}
            disabled={saving || !form.role || hasFormatError}
            saving={saving}
            busyLabel={t('creating')}
            idleLabel={t('create')}
          />
        </form>
    </FloatingPanel>
  )
}
