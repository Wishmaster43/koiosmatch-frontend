/**
 * useEmbeddedSignup — the Embedded Signup state machine (WHATSAPP-COEXIST-PREP-1,
 * §3 logic in hooks). Owns: the config gate (ready?), lazily loading Meta's JS
 * SDK, the popup flow (Facebook Login for Business, code response), capturing
 * the session-info postMessage that carries waba_id/phone_number_id, the
 * server-side exchange, and the optional history sync afterwards.
 *
 * SECURITY (§7): the SDK script is the ONE sanctioned third-party script, loaded
 * only after `ready` and only on this screen — never in index.html. The
 * postMessage listener accepts ONLY facebook.com origins and ONLY the
 * WA_EMBEDDED_SIGNUP payload type; everything else is ignored unparsed-beyond-
 * JSON. The auth `code` goes to our backend once and is never stored here.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getEmbeddedSignupConfig, exchangeEmbeddedSignup, requestHistorySync } from './embeddedSignupApi'
import { FEATURE_TYPE, loadFacebookSdk } from './facebookSdk'
import type { FacebookSdk } from './facebookSdk'
import type { EmbeddedSignupConfig, HistorySyncResult } from './embeddedSignupApi'

export type SignupPhase = 'config-loading' | 'not-ready' | 'config-error' | 'idle' | 'authorizing' | 'exchanging' | 'linked' | 'error'

export interface UseEmbeddedSignupResult {
  phase: SignupPhase
  config: EmbeddedSignupConfig | null
  errorKey: 'popupClosed' | 'exchangeFailed' | 'sdkFailed' | null
  linked: { connectionId: string; wabaId: string; phoneNumberId: string | null } | null
  start: () => Promise<void>
  // History sync for the freshly linked number — null result until requested.
  syncState: 'idle' | 'busy' | 'done' | 'failed'
  syncResult: HistorySyncResult | null
  startHistorySync: () => Promise<void>
}

// The state machine driving the whole Embedded Signup flow — see the module doc
// comment above for the full config→popup→exchange→sync sequence it owns.
export function useEmbeddedSignup(onLinked?: () => void): UseEmbeddedSignupResult {
  const [phase, setPhase] = useState<SignupPhase>('config-loading')
  const [config, setConfig] = useState<EmbeddedSignupConfig | null>(null)
  const [errorKey, setErrorKey] = useState<UseEmbeddedSignupResult['errorKey']>(null)
  const [linked, setLinked] = useState<UseEmbeddedSignupResult['linked']>(null)
  const [syncState, setSyncState] = useState<UseEmbeddedSignupResult['syncState']>('idle')
  const [syncResult, setSyncResult] = useState<HistorySyncResult | null>(null)
  // The session-info message arrives DURING the popup, before FB.login's own
  // callback — held in a ref until the code lands.
  const sessionRef = useRef<{ wabaId: string | null; phoneNumberId: string | null }>({ wabaId: null, phoneNumberId: null })

  // Config gate — abort-guarded (§9).
  useEffect(() => {
    const ctrl = new AbortController()
    getEmbeddedSignupConfig(ctrl.signal)
      .then(cfg => { setConfig(cfg); setPhase(cfg.ready && cfg.app_id && cfg.config_id ? 'idle' : 'not-ready') })
      .catch(() => { if (!ctrl.signal.aborted) setPhase('config-error') })
    return () => ctrl.abort()
  }, [])

  // Session-info listener: facebook.com origins only, WA_EMBEDDED_SIGNUP only.
  useEffect(() => {
    // Only trust facebook.com origins and the WA_EMBEDDED_SIGNUP payload type;
    // anything else, including a non-JSON frame, is ignored (§7).
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') return
        const wabaId = data?.data?.waba_id ?? null
        const phoneNumberId = data?.data?.phone_number_id ?? null
        if (wabaId) sessionRef.current = { wabaId: String(wabaId), phoneNumberId: phoneNumberId ? String(phoneNumberId) : null }
      } catch { /* non-JSON frames from facebook are not ours — ignore */ }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Kicks off the popup flow: loads the FB SDK, opens FB.login, and on a successful
  // code + waba_id pair exchanges it server-side to link the connection.
  const start = useCallback(async () => {
    if (!config?.ready || !config.app_id || !config.config_id) return
    setErrorKey(null)
    sessionRef.current = { wabaId: null, phoneNumberId: null }
    let sdk: FacebookSdk
    try {
      sdk = await loadFacebookSdk(config.app_id, config.graph_version)
    } catch {
      setErrorKey('sdkFailed'); setPhase('error'); return
    }
    setPhase('authorizing')
    sdk.login((response) => {
      const code = response.authResponse?.code
      const { wabaId, phoneNumberId } = sessionRef.current
      if (!code || !wabaId) {
        // Popup closed or flow abandoned — calm return to idle, not an error toast.
        setErrorKey(code || wabaId ? 'exchangeFailed' : 'popupClosed')
        setPhase(code || wabaId ? 'error' : 'idle')
        return
      }
      setPhase('exchanging')
      exchangeEmbeddedSignup({ code, waba_id: wabaId, phone_number_id: phoneNumberId ?? undefined })
        .then(res => {
          setLinked({ connectionId: res.id, wabaId: res.waba_id, phoneNumberId })
          setPhase('linked')
          onLinked?.()
        })
        .catch(() => { setErrorKey('exchangeFailed'); setPhase('error') })
    }, {
      config_id: config.config_id,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: FEATURE_TYPE, sessionInfoVersion: '3' },
    })
  }, [config, onLinked])

  // Chat-history + contacts sync — only offered once linked with a phone number.
  const startHistorySync = useCallback(async () => {
    if (!linked?.connectionId || !linked.phoneNumberId) return
    setSyncState('busy')
    try {
      setSyncResult(await requestHistorySync(linked.connectionId, linked.phoneNumberId))
      setSyncState('done')
    } catch {
      setSyncState('failed')
    }
  }, [linked])

  return { phase, config, errorKey, linked, start, syncState, syncResult, startHistorySync }
}
