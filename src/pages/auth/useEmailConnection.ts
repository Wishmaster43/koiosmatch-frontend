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
import api from '@/lib/api'

export type EmailStatus = 'loading' | 'disconnected' | 'connected' | 'unavailable'
export interface EmailInfo { provider: string | null; email: string | null }
export interface SmtpForm {
  host: string; port: string; user: string; pass: string
  secure: string; from_name: string; from_email: string
}

// Pull the HTTP status off an axios-style error without leaking the rest.
const statusOf = (e: unknown) => (e as { response?: { status?: number } })?.response?.status

export function useEmailConnection() {
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

  // OAuth providers: fetch a consent URL and redirect the browser to it.
  const connectOauth = async (provider: string) => {
    setBusy(true)
    try {
      const { url } = (await api.post('/profile/email/connect', { provider })).data ?? {}
      if (url) { window.location.href = url; return }
    } catch (e) { if (statusOf(e) === 404) setStatus('unavailable') }
    setBusy(false)
  }

  // SMTP: persist the manual credentials and reflect the connected state.
  const saveSmtp = async (smtp: SmtpForm) => {
    setBusy(true)
    try {
      const d = (await api.post('/profile/email/smtp', smtp)).data
      setStatus(d?.status ?? 'connected')
      setInfo({ provider: 'smtp', email: d?.email ?? (smtp.from_email || smtp.user) })
    } catch (e) { if (statusOf(e) === 404) setStatus('unavailable') }
    setBusy(false)
  }

  // Drop the connection and return to the provider chooser.
  const disconnect = async () => {
    setBusy(true)
    try { await api.post('/profile/email/disconnect') } catch { /* noop */ }
    setStatus('disconnected'); setInfo({ provider: null, email: null }); setBusy(false)
  }

  return { status, info, busy, connectOauth, saveSmtp, disconnect }
}
