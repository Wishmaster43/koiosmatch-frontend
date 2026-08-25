/**
 * WhatsAppConnectionForm — create OR edit one WhatsApp Business token (WA-VESTIGING-FE-1).
 * Replaces the old single-connection AddWhatsAppConnectionForm now that a tenant can hold
 * MULTIPLE tokens, each scoped to everyone / one branch / one role (Danny, repeatedly:
 * "elke API key kan voor een vestiging zijn — Yesway Zorg, Yesway Works, Yesway Flex"
 * — every API key can be for one branch — Yesway Zorg, Yesway Works, Yesway Flex,
 * later extended to per-role).
 *
 * CREATE (POST /whatsapp): waba_id + access_token are required; app_secret/verify_token/
 * label are OMITTED when left blank (CONSIST-2 — never sent as ''); scope sends the
 * chosen location_id/role_name only. A valid token is verified straight away (check-status),
 * same as the old form — tolerated on failure, the row's own check-status action takes over.
 *
 * EDIT (PATCH /whatsapp/{id}): waba_id is now EDITABLE too (WA-WABA-EDIT-1) — the
 * update route accepts `waba_id` and, when the trimmed value differs from the stored
 * one, treats it as a real WABA switch: it deactivates every phone number linked to
 * the connection (they were registered under the old account) and returns
 * `phone_numbers_deactivated` on the response. So a changed waba_id is confirmed
 * (ConfirmDialog, danger tone) before it is sent, and a deactivation count > 0 in the
 * response surfaces as a notice telling the user to re-sync. An unchanged value is
 * never sent (the server would treat it as a no-op anyway; omitting it pins the seam).
 * A blank secret field means "leave unchanged" (the contract's own words) — so
 * access_token/app_secret/webhook_verify_token are OMITTED when blank, exactly like
 * create's CONSIST-2 convention. label/provider/location_id/role_name are always sent
 * explicitly (incl. null) so switching scope back to "everyone" actually clears the old
 * value — omitting them would leave the previous scope untouched.
 *
 * WA-WABA-POLISH-1 (Opus review, 4 minors closed): (1) the trimmed-compare/trimmed-send
 * semantics are pinned by a regression test — a padded-but-equal value never counts as
 * a switch, a padded-changed value sends the trimmed one. (2) a client-side length cap
 * mirrors the update route's own `max:64` (WhatsappController::update) so an over-length
 * id can no longer pass the danger confirm and only then die on the server's 422 — the
 * create route has no server-side max at all, so the same cap applies there too, for the
 * same reason. (3) a WABA switch re-verifies the connection via check-status even when no
 * token was rotated — previously only a rotated token triggered that call, leaving the
 * status stale after a switch until the row's own manual re-check ran.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { notify } from '@/lib/notify'
import { useConfirm } from '@/hooks/useConfirm'
import { Field, TextField, SelectField, Label } from '@/components/forms/fields'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/typography'
import { useLocations } from '@/lib/useLocations'
import { useAssignableRoles, roleLabel } from '@/pages/users/shared'
import type { WhatsappConnectionRow } from '@/types/whatsapp'

// The update response merges the connection with this count (0 when no real switch
// happened) — see WhatsappController::update's measured contract.
interface WhatsappUpdateResponse extends WhatsappConnectionRow { phone_numbers_deactivated?: number }

// Provider options are brand names (data, not prose) — no i18n by design.
const PROVIDERS = [
  { value: 'meta', label: 'Meta' },
  { value: '360dialog', label: '360dialog' },
]

// F3: mirrors the update route's `waba_id => 'sometimes|string|max:64'` — TextField
// has no maxLength passthrough (checked in forms/fields.tsx), so this is enforced as
// honest inline validation (block submit + a visible message), never a silent truncation.
const WABA_ID_MAX_LENGTH = 64

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
  const { confirm, dialog } = useConfirm()
  const locationOptions = locations.map(l => ({ value: String(l.value), label: l.label }))
  // Same translated label the Users screen shows (roleLabel → users:roles.<name>).
  const roleOptions = roles.map(r => ({ value: r.name, label: String(roleLabel(tUsers, r.name)) }))

  // waba_id is required in BOTH modes now (WA-WABA-EDIT-1) — emptying it in edit
  // mode is a validation error, never a silently-dropped PATCH (§3).
  const missingWaba = tried && !wabaId.trim()
  const missingToken = !isEdit && tried && !accessToken.trim()
  const missingScope = tried && ((scope === 'location' && !locationId) || (scope === 'role' && !roleName))
  // A real WABA switch — the value the server would actually act on. Compared and
  // sent TRIMMED on both sides: a padded-but-equal value (e.g. '  123  ' vs stored
  // '123') is never a switch, and a padded-changed value sends the trimmed form.
  const trimmedWaba = wabaId.trim()
  const wabaChanged = Boolean(isEdit && connection && trimmedWaba !== connection.waba_id)
  // F3: block an over-length id before it can reach the danger confirm or the request.
  const wabaTooLong = tried && trimmedWaba.length > WABA_ID_MAX_LENGTH

  const SCOPE_OPTIONS = [
    { value: 'everyone', label: t('whatsapp.scopeEveryone'), description: t('whatsapp.scopeEveryoneDesc') },
    { value: 'location', label: t('whatsapp.scopeLocation'), description: t('whatsapp.scopeLocationDesc') },
    { value: 'role', label: t('whatsapp.scopeRole'), description: t('whatsapp.scopeRoleDesc') },
  ]

  // The actual save — split out from `submit` so a WABA switch can be gated behind
  // a confirmation without duplicating the request-building logic.
  const performSave = async () => {
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
        // Only present when it actually changed — an unchanged value is never sent
        // (the server treats same-value as a no-op anyway; this pins the seam).
        if (wabaChanged) body.waba_id = trimmedWaba
        // Blank secret = "leave unchanged" (the contract's own words) — never sent.
        if (accessToken) body.access_token = accessToken
        if (appSecret) body.app_secret = appSecret
        if (verifyToken.trim()) body.webhook_verify_token = verifyToken.trim()
        const res = await api.patch(`/whatsapp/${connection.id}`, body)
        // A real switch deactivated the connection's phone numbers server-side —
        // tell the user so it is never a silent side effect (§3).
        const updated = unwrap<WhatsappUpdateResponse>(res)
        const deactivated = updated?.phone_numbers_deactivated ?? 0
        if (deactivated > 0) notify('info', t('whatsapp.wabaSwitchDeactivatedNotice', { count: deactivated }))
        // F4: a rotated token OR a real WABA switch is worth re-verifying immediately —
        // a switch alone used to skip this call, leaving status stale until the row's
        // own manual re-check ran. Same endpoint the manual button uses, never a second client.
        if (accessToken || wabaChanged) { try { await api.post(`/whatsapp/${connection.id}/check-status`) } catch { /* tolerated — the row's own check-status action takes over */ } }
      } else {
        // Create-path: optional empty fields are OMITTED, never sent as '' (CONSIST-2).
        const body: Record<string, unknown> = { waba_id: trimmedWaba, access_token: accessToken, provider }
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

  // One submit for both modes — the request shape (and what counts as "required")
  // differs, but the scope/error/save plumbing is identical. A real WABA switch is
  // gated behind a confirmation (it deactivates every linked phone number).
  const submit = () => {
    setTried(true)
    if (!wabaId.trim()) return
    // F3: an over-length id is rejected here, before the danger confirm ever opens.
    if (trimmedWaba.length > WABA_ID_MAX_LENGTH) return
    if (!isEdit && !accessToken.trim()) return
    if (scope === 'location' && !locationId) return
    if (scope === 'role' && !roleName) return
    if (wabaChanged) {
      confirm(t('whatsapp.wabaSwitchConfirmMessage'), () => { void performSave() }, {
        title: t('whatsapp.wabaSwitchConfirmTitle'),
        danger: true,
        confirmLabel: t('whatsapp.wabaSwitchConfirmButton'),
      })
      return
    }
    void performSave()
  }

  return (
    <div style={{ marginTop: 16, padding: '18px 18px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 12 }}>
      <SectionTitle as="div">{t(isEdit ? 'whatsapp.formTitleEdit' : 'whatsapp.formTitleCreate')}</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, marginTop: 14 }}>
        <Field label={t('whatsapp.labelField')}>
          <TextField value={label} onChange={setLabel} placeholder={t('whatsapp.labelFieldPlaceholder')} />
        </Field>

        {/* WA-WABA-EDIT-1: editable in both modes now — a real change is confirmed
            (see submit()) since the server deactivates every linked phone number. */}
        <Field label={t('whatsapp.wabaId')} required>
          <TextField value={wabaId} onChange={setWabaId} error={missingWaba || wabaTooLong} placeholder={t('whatsapp.wabaIdPlaceholder')} />
        </Field>

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
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>
          {t(isEdit ? 'whatsapp.wabaIdRequired' : 'whatsapp.addConnectionRequired')}
        </div>
      )}
      {/* F3: an honest, visible cap message — never a silent truncation. */}
      {wabaTooLong && (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>
          {t('whatsapp.wabaIdTooLong', { max: WABA_ID_MAX_LENGTH })}
        </div>
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
      {dialog}
    </div>
  )
}
