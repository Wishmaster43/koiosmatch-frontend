/**
 * EmailSettings: one full email connection PER context (customers / candidates /
 * planning), each its own tab. Because connecting e.g. Gmail for client reminders
 * vs. planning means separate accounts, every context has its own provider/SMTP
 * credentials, sender identity AND email signature. Everything is stored under
 * `email_<context>_*` settings keys; the BE routes, the test-mail body and the
 * OAuth callback carry the same English context (SETTINGS-ALIAS-RETIRE-1).
 * The signature is HTML (RichTextEditor).
 *
 * A signature is a static sign-off block, not a conversation, so it never
 * opts into "Actiepunten" - it rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Mail } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { loadSettings, saveSettings } from '../lib/settingsApi'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import { PageTitle, PageSubtitle } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import type { EmailContext } from '../lib/emailContexts'
import { getHashParams, oauthReasonKey, stripOauthParams } from '@/lib/hashQuery'
import { SETTINGS_MAX_W_WIDE } from '@/pages/settings/components/settingsMetrics'
import type { EmailConnStatus, OutcomeBanner } from './email/types'
import EmailOutcomeBanner from './email/EmailOutcomeBanner'
import EmailProviderCard from './email/EmailProviderCard'
import EmailSenderCard from './email/EmailSenderCard'
import EmailSmtpCard from './email/EmailSmtpCard'
import EmailSignatureCard from './email/EmailSignatureCard'

// Props: which context (customers/candidates/planning) this tab configures; the settings keys,
// the BE routes, the test-mail body and the OAuth callback all carry it (SETTINGS-ALIAS-RETIRE-1).
interface EmailSettingsProps {
  context?: EmailContext
}

export default function EmailSettings({ context = 'customers' }: EmailSettingsProps) {
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
  const [showPass,     setShowPass]      = useState(false)
  const [saved,        setSaved]         = useState(false)
  const [saving,       setSaving]        = useState(false)
  const [loading,      setLoading]       = useState(true)
  const [testing,      setTesting]       = useState(false)
  const [testResult,   setTestResult]    = useState<OutcomeBanner | null>(null)
  // N007-POINT3-FIX-1: true after a SUCCESSFUL test send until a form setting
  // changes or 60s pass — a repeat click while true never re-sends the real
  // test e-mail. A failed test keeps today's behaviour (button re-enabled).
  const [testSent,     setTestSent]      = useState(false)
  const testSentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Alive guard so the 60s timeout never setState after unmount.
  const aliveRef = useRef(true)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; if (testSentTimerRef.current) clearTimeout(testSentTimerRef.current) } }, [])
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
    // ONIX L-002 (BE 84917a3e): the consent flow is bound to the browser that started
    // it; `reason=browser_mismatch` means the state came back in another browser.
    const suffix = oauthReasonKey(params.get('reason'))
    setOauthBanner(outcome === 'connected'
      ? { ok: true, msg: t('email.oauthCallbackConnected', { email: params.get('email') || '' }) }
      : { ok: false, msg: suffix ? t(`email.oauthReason${suffix}`) : t('email.oauthCallbackError') })
    if (outcome === 'connected') loadConnStatus()
    stripOauthParams()
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
  // N007-POINT3-FIX-1: a successful send flips the button into a disabled "done"
  // state for 60s (or until the form changes, see the effect below) so a repeat
  // click right after success never fires a second real test e-mail.
  const testConnection = async () => {
    if (testing || testSent) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post('/settings/email/test', { context })
      setTestResult({ ok: true, msg: res.data?.message ?? t('email.testSent') })
      setTestSent(true)
      if (testSentTimerRef.current) clearTimeout(testSentTimerRef.current)
      testSentTimerRef.current = setTimeout(() => { if (aliveRef.current) setTestSent(false) }, 60000)
    } catch (err) {
      setTestResult({ ok: false, msg: (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? t('email.testFailed') })
    }
    setTesting(false)
  }

  // N007-POINT3-FIX-1: any provider/context setting change re-enables the test
  // button immediately — the user is now testing a DIFFERENT configuration.
  // `context` is in the deps too (verifier fix): the registry can reuse this
  // component's instance across the customers/candidates/planning sub-tabs
  // (groups.communication.tsx), and without it a test sent on one context left
  // the `email.testSentButton` state disabled on another that was never actually tested.
  useEffect(() => {
    setTestSent(false)
    if (testSentTimerRef.current) { clearTimeout(testSentTimerRef.current); testSentTimerRef.current = null }
  }, [context, provider, fromName, fromEmail, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, signature])

  // T-009/T-006: translate the sentence from the reason code; the server text is only the fallback for an unknown code.
  const reasonSuffix = oauthReasonKey(connStatus?.status_reason ?? null)
  const statusSentence = reasonSuffix
    ? t(`email.oauthReason${reasonSuffix}`)
    : connStatus?.status_message || t(connStatus?.status === 'tenant_policy' ? 'email.tenantPolicy' : 'email.needsReconnect')

  return (
    // SETTINGS-INCON-B1b: house-wide container (matches the widest settings screen,
    // CvTemplateSettings) so the connection column and the signature column sit side
    // by side legibly instead of being crushed at 940.
    <div style={{ maxWidth: SETTINGS_MAX_W_WIDE }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <PageTitle>{t(`email.context.${context}.title`)}</PageTitle>
          <PageSubtitle as="p" style={{ marginTop: 2 }}>{t(`email.context.${context}.subtitle`)}</PageSubtitle>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button variant="secondary" onClick={testConnection} disabled={testing || testSent}>
            {testing ? <Spinner size={13} /> : testSent ? <Check size={13} /> : <Mail size={13} />}
            {testSent ? t('email.testSentButton') : t('email.testConnection')}
          </Button>
          {/* SaveButton — the ONE saved-state save action (§4 success token pair). No
              explicit children: SaveButton's own saved/saving/save face (DRY round 11,
              SETTINGS2) renders the identical Check/Spinner/Save + common:saved/saving/save. */}
          <SaveButton saved={saved} saving={saving} onClick={save} disabled={saving} />
        </div>
      </div>

      {testResult && <EmailOutcomeBanner banner={testResult} />}

      {/* DL-10: the OAuth callback landing banner (connected/error), shown once. */}
      {oauthBanner && <EmailOutcomeBanner banner={oauthBanner} />}

      {loading && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('common.loading')}</p>}
      {loadError && <p style={{ fontSize: 13, color: 'var(--color-danger-text)', marginBottom: 12 }}>{t('statusList.loadError')}</p>}

      {/* Two columns: connection settings stacked left, signature alongside right.
          items-stretch lets the signature card match the left column's height. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">

        {/* Left column — provider, sender identity and SMTP credentials */}
        <div className="flex flex-col gap-3">

        {/* Provider choice */}
        <EmailProviderCard provider={provider} onProviderChange={setProvider} connLoading={connLoading}
          connStatus={connStatus} statusSentence={statusSentence} canEditConn={canEditConn}
          connecting={connecting} disconnecting={disconnecting} onConnect={connectOauth} onDisconnect={disconnectOauth} />

        {/* Sender details */}
        <EmailSenderCard fromName={fromName} fromEmail={fromEmail} onFromNameChange={setFromName} onFromEmailChange={setFromEmail} />

        {/* SMTP (manual only) */}
        {provider === 'manual' && (
          <EmailSmtpCard smtpHost={smtpHost} smtpPort={smtpPort} smtpUser={smtpUser} smtpPass={smtpPass}
            smtpPassSet={smtpPassSet} smtpSecure={smtpSecure} showPass={showPass}
            onHostChange={setSmtpHost} onPortChange={setSmtpPort} onUserChange={setSmtpUser}
            onPassChange={setSmtpPass} onSecureChange={setSmtpSecure} onToggleShowPass={() => setShowPass(s => !s)} />
        )}

        </div>{/* end left column */}

        {/* Right column — email signature (per context); fills the column height alongside the connection blocks */}
        <EmailSignatureCard signature={signature} onSignatureChange={setSignature} />

      </div>
    </div>
  )
}
