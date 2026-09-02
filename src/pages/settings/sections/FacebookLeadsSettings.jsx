/**
 * FacebookLeadsSettings (FB-LEADS-1, Instellingen → Integraties) — the tenant
 * pastes ONE Facebook Leads app's credentials here: a plain verify token (webhook
 * handshake), an encrypted app secret + access token (masked — mirrors
 * EmailSettings' SMTP password field, koiosmatch-api SettingController::MASK),
 * and a plain Conversions API dataset id. Below that, a read-only line shows
 * THIS tenant's webhook URL (GET/POST /facebook/webhook/{tenant}) to paste into
 * the Facebook app dashboard — mirrors IncomingWebhooks.jsx's copy-URL row.
 * Persistence goes through the shared GET/POST /settings helpers (same
 * mechanism as MfaEnforcementSetting.jsx and every other settings screen).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Copy, Check, Save, AlertTriangle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { notifyError } from '@/lib/notify'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import { PageTitle, formLabelStyle } from '@/components/ui/typography'
import { publicApiUrl } from '@/lib/publicApiUrl'

// The exact placeholder the backend masks a stored secret with (SettingController::MASK) —
// matching it lets the FE tell "already set" apart from "empty" without ever seeing the value.
const MASK = '••••••••'



// Shared FormLabel identity (12/500/muted) + this file's own layout (§4: identity from the atom, layout local).
const labelStyle = { ...formLabelStyle, marginBottom: 4, display: 'block' }
// Canon field style (G33/fieldMetrics) — was its own padding-8/12 copy.
const inputStyle = fieldInputStyle

// One masked secret field: starts empty, shows a "✓ set" badge when the server
// already stores a value, and reveals/hides on demand (mirrors EmailSettings' smtp_pass).
// `id` gives the label a real `htmlFor` association (§6 — every input needs one).
function SecretField({ id, label, value, onChange, alreadySet, setBadge, placeholderSet, placeholderEmpty, showLabel, hideLabel }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {alreadySet && !value && (
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success-text)', fontWeight: 400 }}>{setBadge}</span>
        )}
      </label>
      <div style={{ position: 'relative' }}>
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={alreadySet ? placeholderSet : placeholderEmpty}
          style={{ ...inputStyle, paddingRight: 36 }} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? hideLabel : showLabel}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

// Loads and saves the tenant's Facebook Leads credentials (verify token, masked app secret/access token, dataset id) through the shared settings endpoints.
export default function FacebookLeadsSettings() {
  const { t } = useTranslation('settings')
  const { activeTenant } = useAuth()
  const [verifyToken, setVerifyToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [appSecretSet, setAppSecretSet] = useState(false)
  const [accessTokenSet, setAccessTokenSet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load the tenant's current values once; secrets arrive as the MASK (never the real value).
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    loadSettings().then((s) => {
      if (!alive) return
      setVerifyToken(s.facebook_verify_token ?? '')
      setDatasetId(s.facebook_dataset_id ?? '')
      setAppSecretSet(s.facebook_app_secret === MASK)
      setAccessTokenSet(s.facebook_access_token === MASK)
    }).catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reloadKey])

  // Persist; a secret is only sent when the user actually typed a new value — an
  // empty field means "keep the stored one" (mirrors EmailSettings' smtp_pass).
  const save = async () => {
    setSaving(true)
    const payload = { facebook_verify_token: verifyToken, facebook_dataset_id: datasetId }
    if (appSecret) payload.facebook_app_secret = appSecret
    if (accessToken) payload.facebook_access_token = accessToken
    try {
      await saveSettings(payload)
      setAppSecretSet(appSecretSet || Boolean(appSecret))
      setAccessTokenSet(accessTokenSet || Boolean(accessToken))
      setAppSecret('')
      setAccessToken('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      notifyError(t('facebookLeads.saveError'))
    } finally {
      setSaving(false)
    }
  }

  // This tenant's own webhook URL — paste target for the Facebook app dashboard.
  const webhookUrl = activeTenant?.id ? publicApiUrl(`/facebook/webhook/${activeTenant.id}`) : null
  // Copies this tenant's webhook URL to the clipboard and flashes a copied confirmation for 2 seconds.
  const copyUrl = () => {
    if (!webhookUrl) return
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('common.loadingShort')}</p>

  // Load failure gets an honest error + retry instead of a silently blank form (§9).
  if (loadError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger-text)', fontSize: 13 }}>
        <AlertTriangle size={14} /> {t('facebookLeads.loadError')}
      </div>
      <Button variant="secondary" onClick={() => setReloadKey(k => k + 1)}>
        <RefreshCw size={13} /> {t('facebookLeads.retry')}
      </Button>
    </div>
  )

  return (
    <div style={{ maxWidth: 560 }}>
      <PageTitle>{t('facebookLeads.title')}</PageTitle>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 20 }}>{t('facebookLeads.subtitle')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        <div>
          <label htmlFor="fb-verify-token" style={labelStyle}>{t('facebookLeads.verifyToken')}</label>
          <input id="fb-verify-token" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)}
            placeholder={t('facebookLeads.verifyTokenPlaceholder')} style={inputStyle} />
        </div>

        <SecretField id="fb-app-secret" label={t('facebookLeads.appSecret')} value={appSecret} onChange={setAppSecret}
          alreadySet={appSecretSet} setBadge={t('facebookLeads.secretSet')}
          placeholderSet={t('facebookLeads.secretKeepPlaceholder')} placeholderEmpty={t('facebookLeads.appSecretPlaceholder')}
          showLabel={t('facebookLeads.showSecret')} hideLabel={t('facebookLeads.hideSecret')} />

        <SecretField id="fb-access-token" label={t('facebookLeads.accessToken')} value={accessToken} onChange={setAccessToken}
          alreadySet={accessTokenSet} setBadge={t('facebookLeads.secretSet')}
          placeholderSet={t('facebookLeads.secretKeepPlaceholder')} placeholderEmpty={t('facebookLeads.accessTokenPlaceholder')}
          showLabel={t('facebookLeads.showSecret')} hideLabel={t('facebookLeads.hideSecret')} />

        <div>
          <label htmlFor="fb-dataset-id" style={labelStyle}>{t('facebookLeads.datasetId')}</label>
          <input id="fb-dataset-id" value={datasetId} onChange={(e) => setDatasetId(e.target.value)}
            placeholder={t('facebookLeads.datasetIdPlaceholder')} style={inputStyle} />
        </div>
      </div>

      <Button variant="primary" onClick={save} disabled={saving}
        style={{ marginBottom: 24 }}>
        <Save size={14} />
        {saving ? t('common.saving') : saved ? t('common.saved') : t('common.save')}
      </Button>

      {/* Read-only webhook URL to paste into the Facebook app dashboard. */}
      <div>
        <label style={labelStyle}>{t('facebookLeads.webhookUrl')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <code style={{ flex: 1, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", background: 'var(--hover-bg)',
            border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text)', wordBreak: 'break-all' }}>
            {webhookUrl ?? '—'}
          </code>
          <button onClick={copyUrl} disabled={!webhookUrl}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 11, fontWeight: 500,
              background: copied ? 'var(--color-success-bg)' : 'var(--hover-bg)', color: copied ? 'var(--color-success)' : 'var(--text)',
              border: 'none', borderRadius: 6, cursor: webhookUrl ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
            {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? t('common.copied') : t('facebookLeads.copyUrl')}
          </button>
        </div>
      </div>
    </div>
  )
}
