/**
 * useAuthRequest — shared start of a public auth request (forgot, reset, accept invite):
 * owns the 429 countdown and primes the CSRF cookie before the POST.
 */
import { useCallback } from 'react'
import { primeCsrf } from '@/lib/api'
import { useRetryCountdown } from '@/hooks/useRetryCountdown'

export function useAuthRequest() {
  const countdown = useRetryCountdown()
  const { clear } = countdown

  // Reset the throttle, then prime CSRF (the page may be opened cold from a mail link).
  const begin = useCallback(async () => {
    clear()
    try { await primeCsrf() } catch { /* a failed prime never blocks the attempt */ }
  }, [clear])

  return { countdown, begin }
}
