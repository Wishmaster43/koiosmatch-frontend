import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPrivacyNotice } from '../api'

type NoticeStatus = 'loading' | 'error' | 'ready'

// Contract: version is exactly 12 hex chars; anything else is unknown (null) so a malformed value can never 422 an application.
function validVersion(v: unknown): string | null {
  return typeof v === 'string' && /^[0-9a-f]{12}$/.test(v) ? v : null
}

// Loads the bureau privacy notice (K-012) on mount and on retry; a response that
// arrives after unmount or after a newer request is ignored.
export function usePrivacyNotice(tenant: string | undefined, locale: string) {
  const [state, setState] = useState<{ status: NoticeStatus; text: string | null; version: string | null }>({ status: 'loading', text: null, version: null })
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(0)

  useEffect(() => {
    // Request counter as alive guard: only the newest request may write state, so a stale
    // response (unmount, retry, StrictMode's double mount) is ignored instead of racing.
    const requestId = ++latest.current
    if (!tenant) return
    setState({ status: 'loading', text: null, version: null })
    fetchPrivacyNotice(tenant, locale)
      .then((notice) => {
        if (latest.current !== requestId) return
        setState(notice.text ? { status: 'ready', text: notice.text, version: validVersion(notice.version) } : { status: 'error', text: null, version: null })
      })
      .catch(() => {
        if (latest.current !== requestId) return
        setState({ status: 'error', text: null, version: null })
      })
    return () => {
      latest.current += 1
    }
  }, [tenant, locale, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
