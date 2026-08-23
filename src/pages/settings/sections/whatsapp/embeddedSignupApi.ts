/**
 * embeddedSignupApi — WHATSAPP-COEXIST-PREP-1 (K-160): the three server calls
 * behind the Embedded Signup wizard. Hand-written interfaces (§10: the spec
 * documents request shapes only); verified against CMBE's K-160 contract.
 * The app SECRET never reaches this client — app_id/config_id are public
 * identifiers, the code→token exchange happens server-side.
 */
import api from '@/lib/api'

export interface EmbeddedSignupConfig {
  // False until the platform's Meta app (env) is configured and approved —
  // the wizard renders an honest waiting state and NEVER a dead button (§3).
  ready: boolean
  app_id: string | null
  config_id: string | null
  graph_version: string
}

export interface EmbeddedSignupExchangeResult {
  id: string
  waba_id: string
  provider: string
  phone_registration_skipped?: boolean
  [k: string]: unknown
}

export interface HistorySyncResult {
  history_requested: boolean
  contacts_requested: boolean
}

// Wizard gate — ready=false while Danny's Meta step-0 is not done.
export async function getEmbeddedSignupConfig(signal?: AbortSignal): Promise<EmbeddedSignupConfig> {
  const res = await api.get<{ data: EmbeddedSignupConfig }>('/whatsapp/embedded-signup/config', { signal })
  return (res.data as { data?: EmbeddedSignupConfig }).data ?? (res.data as unknown as EmbeddedSignupConfig)
}

// Server-side token exchange — idempotent per tenant×waba (re-running the
// wizard refreshes the token instead of stacking connections).
export async function exchangeEmbeddedSignup(body: { code: string; waba_id: string; phone_number_id?: string; label?: string }): Promise<EmbeddedSignupExchangeResult> {
  const res = await api.post<{ data: EmbeddedSignupExchangeResult }>('/whatsapp/embedded-signup/exchange', body)
  return (res.data as { data?: EmbeddedSignupExchangeResult }).data ?? (res.data as unknown as EmbeddedSignupExchangeResult)
}

// Fires both smb_app_data requests (chat history + contacts; Meta's 24h window
// after onboarding) for a freshly linked coexistence number.
export async function requestHistorySync(connectionId: string, phoneNumberId: string): Promise<HistorySyncResult> {
  const res = await api.post<{ data: HistorySyncResult }>(`/whatsapp/${connectionId}/request-history-sync`, { phone_number_id: phoneNumberId })
  return (res.data as { data?: HistorySyncResult }).data ?? (res.data as unknown as HistorySyncResult)
}
