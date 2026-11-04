import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPrivacyNotice } from '../api'

type NoticeStatus = 'loading' | 'error' | 'ready'

// Loads the bureau privacy notice (K-012) on mount and on retry; a response that
// arrives after unmount or after a newer request is ignored.
export function usePrivacyNotice(tenant: string | undefined, locale: string) {
  const [state, setState] = useState<{ status: NoticeStatus; text: string | null }>({ status: 'loading', text: null })
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(0)

  useEffect(() => {
    // Request counter as alive guard: only the newest request may write state, so a stale
    // response (unmount, retry, StrictMode's double mount) is ignored instead of racing.
    const requestId = ++latest.current
    if (!tenant) return
    setState({ status: 'loading', text: null })
    fetchPrivacyNotice(tenant, locale)
      .then((notice) => {
        if (latest.current !== requestId) return
        setState(notice.text ? { status: 'ready', text: notice.text } : { status: 'error', text: null })
      })
      .catch(() => {
        if (latest.current !== requestId) return
        setState({ status: 'error', text: null })
      })
    return () => {
      latest.current += 1
    }
  }, [tenant, locale, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
