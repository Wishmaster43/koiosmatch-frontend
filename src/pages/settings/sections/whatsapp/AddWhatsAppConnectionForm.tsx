/**
 * AddWhatsAppConnectionForm — the WABA coupling form for Settings → WhatsApp
 * (WA-CONN-FORM-1, CMBE handoff 13-08). The connections table was wiped in the
 * 13-08 incident and the settings screen's no-connection branch offered no way
 * back in — the original row was created outside this screen entirely. This form
 * POSTs the tenant's WABA credentials, immediately verifies the token via
 * check-status (which flips the connection active when valid), then hands
 * control back to the parent to reload. Secrets are password fields and are
 * never echoed back by the API (model hides them); nothing here is ever logged.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'
import { Field, TextField, SelectField } from '@/components/forms/fields'
import Button from '@/components/ui/Button'
import { SectionTitle } from '@/components/ui/typography'

// Provider options are brand names (data, not prose) — no i18n by design.
const PROVIDERS = [
  { value: 'meta', label: 'Meta' },
  { value: '360dialog', label: '360dialog' },
]

export default function AddWhatsAppConnectionForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation('settings')
  const [wabaId, setWabaId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [verifyToken, setVerifyToken] = useState('')
  // Required-with-default (never clearable): the backend defaults to 'meta' too.
  const [provider, setProvider] = useState('meta')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const missingWaba = tried && !wabaId.trim()
  const missingToken = tried && !accessToken.trim()

  // POST the connection, then verify the token straight away — a valid token
  // flips the row active so the reloaded screen shows a green card, not an
  // inactive one the user must poke. A failed check is tolerated: the row
  // exists, and the card's own "check status" button takes over from there.
  const submit = async () => {
    setTried(true)
    if (!wabaId.trim() || !accessToken.trim()) return
    setSaving(true); setError(null)
    try {
      // Create-path: optional empty fields are OMITTED, never sent as '' (CONSIST-2).
      const res = await api.post('/whatsapp', {
        waba_id: wabaId.trim(),
        access_token: accessToken,
        provider,
        ...(appSecret ? { app_secret: appSecret } : {}),
        ...(verifyToken.trim() ? { webhook_verify_token: verifyToken.trim() } : {}),
      })
      const created = unwrap(res) as { id?: string } | null
      if (created?.id) {
        try { await api.post(`/whatsapp/${created.id}/check-status`) } catch { /* tolerated — see above */ }
      }
      onCreated()
    } catch (e) {
      setError(extractApiError(e, t('whatsapp.addConnectionFailed')))
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: 16, padding: '18px 18px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 12 }}>
      <SectionTitle as="div">{t('whatsapp.addConnectionTitle')}</SectionTitle>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
        {t('whatsapp.addConnectionDesc')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <Field label={t('whatsapp.wabaId')} required>
          <TextField value={wabaId} onChange={setWabaId} error={missingWaba} placeholder={t('whatsapp.wabaIdPlaceholder')} />
        </Field>
        {/* Password type + new-password: never rendered back, never autofilled. */}
        <Field label={t('whatsapp.accessToken')} required>
          <TextField value={accessToken} onChange={setAccessToken} type="password" error={missingToken} />
        </Field>
        <Field label={t('whatsapp.appSecret')}>
          <TextField value={appSecret} onChange={setAppSecret} type="password" />
        </Field>
        <Field label={t('whatsapp.verifyToken')}>
          <TextField value={verifyToken} onChange={setVerifyToken} />
        </Field>
        <Field label={t('whatsapp.provider')}>
          <SelectField value={provider} onChange={v => setProvider(v || 'meta')} options={PROVIDERS} />
        </Field>
      </div>

      {(missingWaba || missingToken) && (
        <div style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{t('whatsapp.addConnectionRequired')}</div>
      )}
      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <Button variant="primary" size="sm" onClick={submit} disabled={saving}>
          <Plus size={12} />
          {saving ? t('whatsapp.addConnectionSaving') : t('whatsapp.addConnectionSubmit')}
        </Button>
      </div>
    </div>
  )
}
