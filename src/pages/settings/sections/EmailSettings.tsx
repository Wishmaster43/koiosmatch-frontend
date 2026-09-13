/**
 * EmailSettings — one full email connection PER context (klanten / kandidaten /
 * planning), each its own tab. Because connecting e.g. Gmail for client reminders
 * vs. planning means separate accounts, every context has its own provider/SMTP
 * credentials, sender identity AND email signature. Everything is stored under
 * `email_<context>_*` settings keys; the signature is HTML (RichTextEditor).
 *
 * A signature is a static sign-off block, not a conversation, so it never
 * opts into "Actiepunten" - it rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Mail, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import RichTextEditor from '@/components/ui/RichTextEditor'
import Spinner from '@/components/ui/Spinner'
import CalloutBox from '@/components/ui/CalloutBox'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { PageTitle, Caption } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { setHashParam } from '@/lib/hashParams'
import { SETTINGS_MAX_W_WIDE } from '@/pages/settings/components/settingsMetrics'

// Pure: read this SPA's hash query string. The app is hash-routed (DashboardLayout
// boots activePage from window.location.hash, there is no /instellingen path
// route), so the OAuth callback lands as `#settings/...?email_oauth=...` — it
// must be read from the hash, never from window.location.search.
function getHashParams(hash: string) {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  return new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1))
}

// Email provider settings for one context (klanten/kandidaten); the context prefixes every settings key so the two contexts never share state.
// Coupling state for this context's OAuth provider (Gmail/Office 365).
interface EmailConnStatus {
  connected?: boolean
  provider?: string
  address?: string
}

// One test-send or OAuth-callback outcome banner.
interface OutcomeBanner {
  ok: boolean
  msg: string
}

// Props: which context (klanten/kandidaten/planning) this tab configures.
interface EmailSettingsProps {
  context?: string
}

export default function EmailSettings({ context = 'klanten' }: EmailSettingsProps) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  // DL-10: the OAuth Koppelen/Ontkoppelen actions both require settings.update on
  // the backend (route:list) — a settings.view-only caller must not see live buttons.
  const canEditConn = Boolean(auth?.hasPermission?.('settings.update'))
  const K = `email_${context}_`   // settings-key prefix for this context

  const [provider,     setProvider]     = useState('manual')
  const [fromName,     setFromName]      = useState('')
  const [fromEmail,    setFromEmail]     = useState('')
  const [smtpHost,     setSmtpHost]      = useState('')
  const [smtpPort,     setSmtpPort]      = useState('587')
  const [smtpUser,     setSmtpUser]      = useState('')
  const [smtpPass,     setSmtpPass]      = useState('')
  const [smtpPassSet,  setSmtpPassSet]   = useState(false)
  const [smtpSecure,   setSmtpSecure]    = useState('tls')
  const [signature,    setSignature]     = useState('')
  const [sigExpanded,  setSigExpanded]    = useState(false)
  const [showPass,     setShowPass]      = useState(false)
  const [saved,        setSaved]         = useState(false)
  const [saving,       setSaving]        = useState(false)
  const [loading,      setLoading]       = useState(true)
  const [testing,      setTesting]       = useState(false)
  const [testResult,   setTestResult]    = useState<OutcomeBanner | null>(null)
  const [loadError,    setLoadError]     = useState(false)
  // DL-10: the real OAuth coupling state for this context — GET /settings/email/{context}/status.
  const [connStatus,   setConnStatus]    = useState<EmailConnStatus | null>(null)
  const [connLoading,  setConnLoading]   = useState(true)
  const [connecting,   setConnecting]    = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  // Banner from the OAuth callback landing (?email_oauth=connected|error) — shown once, then the params are stripped.
  const [oauthBanner,  setOauthBanner]   = useState<OutcomeBanner | null>(null)

  // Loads this context's settings on mount, seeding every field from the stored keys (or a safe default when a key is absent).
  // An alive guard stops a stale response from a previous context tab overwriting a newer one.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    loadSettings()
      .then((stored: Record<string, string | undefined>) => {
        if (!alive) return
        setProvider(stored[`${K}provider`]  ?? 'manual')
        setFromName(stored[`${K}from_name`] ?? '')
        setFromEmail(stored[`${K}from`]     ?? '')
        setSmtpHost(stored[`${K}smtp_host`] ?? '')
        setSmtpPort(stored[`${K}smtp_port`] ?? '587')
        setSmtpUser(stored[`${K}smtp_user`] ?? '')
        setSmtpSecure(stored[`${K}smtp_secure`] ?? 'tls')
        setSmtpPassSet(stored[`${K}smtp_pass`] === '••••••••')
        setSignature(stored[`${K}signature`] ?? '')
      })
      .catch(() => { if (alive) setLoadError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [K])

  // DL-10: the real OAuth coupling state (connected/provider/address) for this
  // context — fetched on mount and re-fetched after every save, so a provider
  // switch or a freshly-completed OAuth flow reflects immediately. useCallback
  // keeps the reference stable per `context`, so effects below can depend on it
  // honestly instead of needing an exhaustive-deps disable.
  const loadConnStatus = useCallback(async (alive: { current: boolean } = { current: true }) => {
    setConnLoading(true)
    try {
      const res = await api.get(`/settings/email/${context}/status`)
      if (alive.current) setConnStatus(res.data?.data ?? null)
    } catch {
      if (alive.current) setConnStatus(null)
    } finally {
      if (alive.current) setConnLoading(false)
    }
  }, [context])

  useEffect(() => {
    const alive = { current: true }
    loadConnStatus(alive)
    return () => { alive.current = false }
  }, [loadConnStatus])

  // DL-10: the OAuth callback lands back on this SPA's hash route with
  // ?email_oauth=connected|error (EmailSettingsController::oauthCallback). Only
  // the tab whose context matches consumes a `connected` result; an `error`
  // result carries no context (a failed state decode never reached the group),
  // so any mounted tab may show it. The params are stripped either way so a
  // refresh never replays it — after the strip `outcome` is empty, so this
  // effect safely no-ops on every later re-run, including a `t`/`context` change.
  useEffect(() => {
    const params = getHashParams(window.location.hash)
    const outcome = params.get('email_oauth')
    if (!outcome) return
    const forThisTab = outcome === 'error' || params.get('context') === context
    if (!forThisTab) return
    setOauthBanner(outcome === 'connected'
      ? { ok: true, msg: t('email.oauthCallbackConnected', { email: params.get('email') || '' }) }
      : { ok: false, msg: t('email.oauthCallbackError') })
    if (outcome === 'connected') loadConnStatus()
    let nextHash = setHashParam(window.location.hash, 'email_oauth', null)
    nextHash = setHashParam(nextHash, 'context', null)
    nextHash = setHashParam(nextHash, 'email', null)
    nextHash = setHashParam(nextHash, 'request_id', null)
    window.history.replaceState(null, '', window.location.pathname + window.location.search + nextHash)
  }, [context, loadConnStatus, t])

  // Persists the current form values under this context's prefixed keys, and flashes the saved state briefly on success.
  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, string> = {
        [`${K}provider`]: provider, [`${K}from_name`]: fromName, [`${K}from`]: fromEmail,
        [`${K}smtp_host`]: smtpHost, [`${K}smtp_port`]: smtpPort, [`${K}smtp_user`]: smtpUser,
        [`${K}smtp_secure`]: smtpSecure, [`${K}signature`]: signature,
      }
      if (smtpPass) payload[`${K}smtp_pass`] = smtpPass
      await saveSettings(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await loadConnStatus()
    } catch { notifyError(t('statusList.saveFailed')) }
    setSaving(false)
  }

  // DL-10: fetch the provider's consent URL and redirect the browser to it —
  // mirrors useEmailConnection.connectOauth's fetch-then-redirect (a bare
  // navigation would 401: the redirect route is sanctum + settings.update and
  // returns JSON, not a 302).
  const connectOauth = async () => {
    setConnecting(true)
    try {
      const res = await api.get(`/settings/email/oauth/${context}/redirect`, { params: { provider } })
      const url = res.data?.url
      if (url) { window.location.href = url; return }
      notifyError(t('email.oauthConnectFailed'))
    } catch (err) {
      notifyError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('email.oauthConnectFailed'))
    }
    setConnecting(false)
  }

  // DL-10: drop the stored OAuth coupling for this context (pessimistic: only
  // reflects locally once the server confirms, via the shared status refetch).
  const disconnectOauth = async () => {
    setDisconnecting(true)
    try {
      await api.delete(`/settings/email/oauth/${context}`)
      await loadConnStatus()
    } catch {
      notifyError(t('email.oauthDisconnectFailed'))
    }
    setDisconnecting(false)
  }

  // Sends a live test email through the configured provider and surfaces the server outcome/error as a banner.
  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post('/settings/email/test', { context })
      setTestResult({ ok: true, msg: res.data?.message ?? t('email.testSent') })
    } catch (err) {
      setTestResult({ ok: false, msg: (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('email.testFailed') })
    }
    setTesting(false)
  }

  // Canon field style (G33/fieldMetrics) — was its own height-34 copy, minus a background.
  const inputStyle = fieldInputStyle
  const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 4, display: 'block' }
  // Shared card chrome — matches the settings kit's SettingCard so this section
  // reads at the same compact density as every other settings panel.
  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }

  const PROVIDERS = [
    { id: 'gmail',  label: 'Gmail',                 desc: t('email.gmailDesc') },
    { id: 'office', label: 'Office 365',            desc: t('email.officeDesc') },
    { id: 'manual', label: t('email.manualLabel'),  desc: t('email.manualDesc') },
  ]

  return (
    // SETTINGS-INCON-B1b: house-wide container (matches the widest settings screen,
    // CvTemplateSettings) so the connection column and the signature column sit side
    // by side legibly instead of being crushed at 940.
    <div style={{ maxWidth: SETTINGS_MAX_W_WIDE }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <PageTitle>{t(`email.context.${context}.title`)}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t(`email.context.${context}.subtitle`)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" onClick={testConnection} disabled={testing}>
            {testing ? <Spinner size={13} /> : <Mail size={13} />}
            {t('email.testConnection')}
          </Button>
          {/* SaveButton — the ONE saved-state save action (§4 success token pair). No
              explicit children: SaveButton's own saved/saving/save face (DRY round 11,
              SETTINGS2) renders the identical Check/Spinner/Save + common:saved/saving/save. */}
          <SaveButton saved={saved} saving={saving} onClick={save} disabled={saving} />
        </div>
      </div>

      {testResult && (
        <div style={{ marginBottom: 14 }}>
          <CalloutBox variant={testResult.ok ? 'success' : 'danger'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {testResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
              {testResult.msg}
            </div>
          </CalloutBox>
        </div>
      )}

      {/* DL-10: the OAuth callback landing banner (connected/error), shown once. */}
      {oauthBanner && (
        <div style={{ marginBottom: 14 }}>
          <CalloutBox variant={oauthBanner.ok ? 'success' : 'danger'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {oauthBanner.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
              {oauthBanner.msg}
            </div>
          </CalloutBox>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('common.loading')}</p>}
      {loadError && <p style={{ fontSize: 13, color: 'var(--color-danger-text)', marginBottom: 12 }}>{t('statusList.loadError')}</p>}

      {/* Two columns: connection settings stacked left, signature alongside right.
          items-stretch lets the signature card match the left column's height. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">

        {/* Left column — provider, sender identity and SMTP credentials */}
        <div className="flex flex-col gap-3">

        {/* Provider choice */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>{t('email.provider')}</div>
          {/* Provider choice — shared SegmentedControl option-card radiogroup, one group
              for the three providers. SETTINGS-INCON-B1b: the chosen provider reads as
              chosen via the §4 "aan/gelukt" success pair, same green as the super-admin
              package picker. */}
          <SegmentedControl
            ariaLabel={t('email.provider')}
            color="var(--color-success)"
            activeOnly
            activeFill="var(--color-success-bg)"
            options={PROVIDERS.map(p => ({ value: p.id, label: p.label, description: p.desc }))}
            value={provider}
            onChange={setProvider}
          />

          {/* DL-10: real coupling state + connect/disconnect — the old copy claimed
              this "must be configured via the backend", which was false: the whole
              OAuth flow already exists and works, the FE simply never called it. */}
          {(provider === 'gmail' || provider === 'office') && (
            <div style={{ marginTop: 14 }}>
              {connLoading ? (
                <Caption>{t('common.loading')}</Caption>
              ) : connStatus?.connected ? (
                <CalloutBox variant="success" title={t('email.oauthConnectedTitle')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span>{t('email.oauthConnected', { provider: connStatus.provider === 'gmail' ? 'Google' : 'Microsoft', address: connStatus.address || '—' })}</span>
                    <Button variant="dangerSoft" size="sm" onClick={disconnectOauth} disabled={disconnecting || !canEditConn}>
                      {disconnecting ? <Spinner size={12} /> : t('email.oauthDisconnect')}
                    </Button>
                  </div>
                </CalloutBox>
              ) : (
                <CalloutBox variant="warning" title={t('email.oauthWarningTitle')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span>{t('email.oauthWarning', { provider: provider === 'gmail' ? 'Google' : 'Microsoft' })}</span>
                    <Button variant="secondary" size="sm" onClick={connectOauth} disabled={connecting || !canEditConn}>
                      {connecting ? <Spinner size={12} /> : t('email.oauthConnect')}
                    </Button>
                  </div>
                </CalloutBox>
              )}
            </div>
          )}
        </div>

        {/* Sender details */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>{t('email.senderDetails')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{t('email.senderName')}</label>
              <input value={fromName} onChange={e => setFromName(e.target.value)} placeholder={t('email.senderNamePlaceholder')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('email.fromAddress')}</label>
              <input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder={t('email.fromPlaceholder')} style={inputStyle} />
            </div>
          </div>
        </div>

        {/* SMTP (manual only) */}
        {provider === 'manual' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>{t('email.smtpConfig')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>{t('email.smtpServer')}</label>
                <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder={t('email.smtpServerPlaceholder')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('email.port')}</label>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>{t('email.username')}</label>
                <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder={t('email.usernamePlaceholder')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  {t('email.password')}
                  {smtpPassSet && !smtpPass && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-success-text)', fontWeight: 400 }}>{t('email.passwordSet')}</span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={smtpPass}
                    onChange={e => setSmtpPass(e.target.value)}
                    placeholder={smtpPassSet ? t('email.passwordKeepPlaceholder') : t('email.passwordPlaceholder')}
                    style={{ ...inputStyle, paddingRight: 36 }} />
                  <Button variant="ghost" iconOnly onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? t('email.hidePassword') : t('email.showPassword')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>{t('email.security')}</label>
              {/* SMTP security pill row — shared SegmentedControl, compact size (§4 soft-tint pill). */}
              <SegmentedControl
                size="compact"
                ariaLabel={t('email.security')}
                options={[
                  { value: 'tls',  label: t('email.secTls') },
                  { value: 'ssl',  label: t('email.secSsl') },
                  { value: 'none', label: t('email.secNone') },
                ]}
                value={smtpSecure}
                onChange={setSmtpSecure}
              />
            </div>
          </div>
        )}

        </div>{/* end left column */}

        {/* Right column — email signature (per context); fills the column height alongside the connection blocks */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{t('email.signature')}</div>
          <Caption as="div" style={{ marginBottom: 10 }}>{t('email.signatureHint')}</Caption>
          <RichTextEditor value={signature} onChange={setSignature} fill
            expanded={sigExpanded} onToggleExpand={() => setSigExpanded(e => !e)} />
        </div>

      </div>
    </div>
  )
}
