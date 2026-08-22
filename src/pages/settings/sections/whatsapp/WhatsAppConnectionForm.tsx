/**
 * WhatsAppConnectionForm — create OR edit one WhatsApp Business token (WA-VESTIGING-FE-1).
 * Replaces the old single-connection AddWhatsAppConnectionForm now that a tenant can hold
 * MULTIPLE tokens, each scoped to everyone / one branch / one role (Danny, repeatedly:
 * "elke API key kan voor een vestiging zijn — Yesway Zorg, Yesway Works, Yesway Flex",
 * later extended to per-role).
 *
 * CREATE (POST /whatsapp): waba_id + access_token are required; app_secret/verify_token/
 * label are OMITTED when left blank (CONSIST-2 — never sent as ''); scope sends the
 * chosen location_id/role_name only. A valid token is verified straight away (check-status),
 * same as the old form — tolerated on failure, the row's own check-status action takes over.
 *
 * EDIT (PATCH /whatsapp/{id}): waba_id is immutable server-side (the update route never
 * accepts it) so it renders read-only, never as a dead editable field (§3 no fake
 * affordance). A blank secret field means "leave unchanged" (the contract's own words) —
 * so access_token/app_secret/webhook_verify_token are OMITTED when blank, exactly like
 * create's CONSIST-2 convention. label/provider/location_id/role_name are always sent
 * explicitly (incl. null) so switching scope back to "everyone" actually clears the old
 * value — omitting them would leave the previous scope untouched.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { Field, TextField, SelectField, Label } from '@/components/forms/fields'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'
import { useLocations } from '@/lib/useLocations'
import { useAssignableRoles, roleLabel } from '@/pages/users/shared'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

// Provider options are brand names (data, not prose) — no i18n by design.
const PROVIDERS = [
  { value: 'meta', label: 'Meta' },
  { value: '360dialog', label: '360dialog' },
]

type Scope = 'everyone' | 'location' | 'role'

interface WhatsAppConnectionFormProps {
  // Absent/null = create mode; present = edit mode (pre-fills scope/label/provider).
  connection?: WhatsappConnectionRow | null
  onSaved: () => void
  onCancel: () => void
}

export default function WhatsAppConnectionForm({ connection, onSaved, onCancel }: WhatsAppConnectionFormProps) {
  const { t } = useTranslation('settings')
  // roleLabel resolves roles.<name> in the USERS namespace (usersParts convention).
  const { t: tUsers } = useTranslation('users')
  const isEdit = Boolean(connection)
  const [label, setLabel] = useState(connection?.label ?? '')
  const [wabaId, setWabaId] = useState(connection?.waba_id ?? '')
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  const [provider, setProvider] = useState(connection?.provider ?? 'meta')
  const [scope, setScope] = useState<Scope>(connection?.role_name ? 'role' : connection?.location_id ? 'location' : 'everyone')
  const [locationId, setLocationId] = useState(connection?.location_id ?? '')
  const [roleName, setRoleName] = useState(connection?.role_name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const locations = useLocations()
  const { roles } = useAssignableRoles()
  const locationOptions = locations.map(l => ({ value: String(l.value), label: l.label }))
  // Same translated label the Users screen shows (roleLabel → users:roles.<name>).
  const roleOptions = roles.map(r => ({ value: r.name, label: String(roleLabel(tUsers, r.name)) }))

  const missingWaba = !isEdit && tried && !wabaId.trim()
  const missingToken = !isEdit && tried && !accessToken.trim()
  const missingScope = tried && ((scope === 'location' && !locationId) || (scope === 'role' && !roleName))

  const SCOPE_OPTIONS = [
    { value: 'everyone', label: t('whatsapp.scopeEveryone'), description: t('whatsapp.scopeEveryoneDesc') },
    { value: 'location', label: t('whatsapp.scopeLocation'), description: t('whatsapp.scopeLocationDesc') },
    { value: 'role', label: t('whatsapp.scopeRole'), description: t('whatsapp.scopeRoleDesc') },
  ]

  // One submit for both modes — the request shape (and what counts as "required")
  // differs, but the scope/error/save plumbing is identical.
  const submit = async () => {
    setTried(true)
    if (!isEdit && (!wabaId.trim() || !accessToken.trim())) return
    if (scope === 'location' && !locationId) return
    if (scope === 'role' && !roleName) return
    setSaving(true); setError(null)
    try {
      if (isEdit && connection) {
        // Always explicit (incl. null) so clearing back to "everyone" really clears
        // the stored scope — omitting a key here would leave the old value untouched.
        const body: Record<string, unknown> = {
          provider,
          label: label.trim() || null,
          location_id: scope === 'location' ? locationId : null,
          role_name: scope === 'role' ? roleName : null,
        }
        // Blank secret = "leave unchanged" (the contract's own words) — never sent.
        if (accessToken) body.access_token = accessToken
        if (appSecret) body.app_secret = appSecret
        if (verifyToken.trim()) body.webhook_verify_token = verifyToken.trim()
        await api.patch(`/whatsapp/${connection.id}`, body)
        // A rotated token is worth re-verifying immediately, same as on create.
        if (accessToken) { try { await api.post(`/whatsapp/${connection.id}/check-status`) } catch { /* tolerated — the row's own check-status action takes over */ } }
      } else {
        // Create-path: optional empty fields are OMITTED, never sent as '' (CONSIST-2).
        const body: Record<string, unknown> = { waba_id: wabaId.trim(), access_token: accessToken, provider }
        if (appSecret) body.app_secret = appSecret
        if (verifyToken.trim()) body.webhook_verify_token = verifyToken.trim()
        if (label.trim()) body.label = label.trim()
        if (scope === 'location') body.location_id = locationId
        if (scope === 'role') body.role_name = roleName
        const res = await api.post('/whatsapp', body)
        const created = unwrap<WhatsappConnectionRow>(res)
        if (created?.id) { try { await api.post(`/whatsapp/${created.id}/check-status`) } catch { /* tolerated — see above */ } }
      }
      onSaved()
    } catch (e) {
      setError(extractApiError(e, t(isEdit ? 'whatsapp.editFailed' : 'whatsapp.addConnectionFailed')))
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: 16, padding: '18px 18px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 12 }}>
      <SectionTitle as="div">{t(isEdit ? 'whatsapp.formTitleEdit' : 'whatsapp.formTitleCreate')}</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, marginTop: 14 }}>
        <Field label={t('whatsapp.labelField')}>
          <TextField value={label} onChange={setLabel} placeholder={t('whatsapp.labelFieldPlaceholder')} />
        </Field>

        {/* waba_id is immutable once created — the update route never accepts it, so
            editing it here would silently be dropped by the server (§3). */}
        {isEdit ? (
          <div>
            <Label>{t('whatsapp.wabaId')}</Label>
            <Caption as="div"><Mono>{connection?.waba_id}</Mono></Caption>
          </div>
        ) : (
          <Field label={t('whatsapp.wabaId')} required>
            <TextField value={wabaId} onChange={setWabaId} error={missingWaba} placeholder={t('whatsapp.wabaIdPlaceholder')} />
          </Field>
        )}

        {/* Password type + new-password: never rendered back, never autofilled. */}
        <Field label={t('whatsapp.accessToken')} required={!isEdit}>
          <TextField value={accessToken} onChange={setAccessToken} type="password" error={missingToken}
            placeholder={isEdit ? t('whatsapp.tokenUnchangedPlaceholder') : undefined} />
        </Field>
        <Field label={t('whatsapp.appSecret')}>
          <TextField value={appSecret} onChange={setAppSecret} type="password"
            placeholder={isEdit ? t('whatsapp.tokenUnchangedPlaceholder') : undefined} />
        </Field>
        {/* A secret like its two siblings (backend: $hidden + encrypted) — never typed in the clear. */}
        <Field label={t('whatsapp.verifyToken')}>
          <TextField value={verifyToken} onChange={setVerifyToken} type="password"
            placeholder={isEdit ? t('whatsapp.tokenUnchangedPlaceholder') : undefined} />
        </Field>
        <Field label={t('whatsapp.provider')}>
          <SelectField value={provider} onChange={v => setProvider((v || 'meta') as 'meta' | '360dialog')} options={PROVIDERS} />
        </Field>

        {/* WA-SCOPE-1: an exclusive choice — the radio enforces it as UX, the 422 is
            the real gate (mapped via extractApiError below). */}
        <div>
          <Label>{t('whatsapp.scopeLabel')}</Label>
          {/* Card size, not compact: the per-option description is the ONLY copy
              explaining what iedereen/vestiging/rol means — compact drops it. */}
          <SegmentedControl options={SCOPE_OPTIONS} value={scope} onChange={v => setScope(v as Scope)}
            ariaLabel={t('whatsapp.scopeLabel')} />
        </div>
        {scope === 'location' && (
          <Field label={t('whatsapp.scopeLocation')} required>
            <SelectField value={locationId} onChange={setLocationId} options={locationOptions}
              placeholder={t('whatsapp.scopeLocationPlaceholder')} />
          </Field>
        )}
        {scope === 'role' && (
          <Field label={t('whatsapp.scopeRole')} required>
            <SelectField value={roleName} onChange={setRoleName} options={roleOptions}
              placeholder={t('whatsapp.scopeRolePlaceholder')} />
          </Field>
        )}
      </div>

      {(missingWaba || missingToken) && (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{t('whatsapp.addConnectionRequired')}</div>
      )}
      {missingScope && (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{t('whatsapp.scopeRequired')}</div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={saving}>
          {!isEdit && <Plus size={12} />}
          {saving ? t('common.saving') : isEdit ? t('common.save') : t('whatsapp.addConnection')}
        </Button>
      </div>
    </div>
  )
}
