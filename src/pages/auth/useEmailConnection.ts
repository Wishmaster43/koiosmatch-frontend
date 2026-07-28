/**
 * useEmailConnection — data layer for ProfileEmailConnect (§3): the user's personal
 * mailbox connection state, the OAuth/SMTP connect flows and disconnect. A 404 on the
 * endpoint degrades to a calm "unavailable" state. Keeps the panel presentational.
 *
 * Backend contract:
 *   GET  /profile/email                     -> { status, provider?, email? }
 *   POST /profile/email/connect {provider}  -> { url }   (oauth: we redirect)
 *   POST /profile/email/smtp {host,port,…}  -> { status:'connected', email }
 *   POST /profile/email/disconnect          -> { status:'disconnected' }
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

export type EmailStatus = 'loading' | 'disconnected' | 'connected' | 'unavailable'
export interface EmailInfo { provider: string | null; email: string | null }
export interface SmtpForm {
  host: string; port: string; user: string; pass: string
  secure: string; from_name: string; from_email: string
}

// Pull the HTTP status off an axios-style error without leaking the rest.
const statusOf = (e: unknown) => (e as { response?: { status?: number } })?.response?.status

export function useEmailConnection() {
  const { t } = useTranslation('auth')
  const [status, setStatus] = useState<EmailStatus>('loading')
  const [info,   setInfo]   = useState<EmailInfo>({ provider: null, email: null })
  const [busy,   setBusy]   = useState(false)

  // Load the current personal-mailbox state (404 → feature unavailable).
  const load = async () => {
    try {
      const d = (await api.get('/profile/email')).data
      setStatus(d?.status ?? 'disconnected')
      setInfo({ provider: d?.provider ?? null, email: d?.email ?? null })
    } catch (e) {
      setStatus(statusOf(e) === 404 ? 'unavailable' : 'disconnected')
    }
  }
  useEffect(() => { load() }, [])

  // OAuth providers: fetch a consent URL and redirect the browser to it. A non-404
  // failure must say so — silently resetting `busy` with no feedback (§3) left the
  // user staring at a button that just... stopped, with no idea it failed.
  const connectOauth = async (provider: string) => {
    setBusy(true)
    try {
      const { url } = (await api.post('/profile/email/connect', { provider })).data ?? {}
      if (url) { window.location.href = url; return }
    } catch (e) {
      if (statusOf(e) === 404) setStatus('unavailable')
      else notifyError(t('profile.email.connectFailed'))
    }
    setBusy(false)
  }

  // SMTP: persist the manual credentials and reflect the connected state. Same
  // silent-failure fix as connectOauth — a rejected save (bad credentials, 422, …)
  // must surface, not vanish.
  const saveSmtp = async (smtp: SmtpForm) => {
    setBusy(true)
    try {
      const d = (await api.post('/profile/email/smtp', smtp)).data
      setStatus(d?.status ?? 'connected')
      setInfo({ provider: 'smtp', email: d?.email ?? (smtp.from_email || smtp.user) })
    } catch (e) {
      if (statusOf(e) === 404) setStatus('unavailable')
      else notifyError(t('profile.email.connectFailed'))
    }
    setBusy(false)
  }

  // Drop the connection and return to the provider chooser. Pessimistic on purpose:
  // only flip local state once the server confirms — the previous version marked
  // 'disconnected' unconditionally, so a failed POST still LIED that the mailbox was
  // unlinked while the backend kept it connected (§3, exactly the "mutation that
  // lies about success" class of bug).
  const disconnect = async () => {
    setBusy(true)
    try {
      await api.post('/profile/email/disconnect')
      setStatus('disconnected'); setInfo({ provider: null, email: null })
    } catch {
      notifyError(t('profile.email.disconnectFailed'))
    }
    setBusy(false)
  }

  return { status, info, busy, connectOauth, saveSmtp, disconnect }
}
