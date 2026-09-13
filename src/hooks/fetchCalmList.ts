/**
 * fetchCalmList — the shared "GET a list, unwrap it, treat 404 as a calm empty
 * list instead of an error" fetch behind useEntityActivity and the per-entity
 * note hooks (useOpportunityNotes, …). A non-404 failure (5xx, network/no
 * response, never a cancelled request) is the only case that flags `setError`;
 * either way the list is cleared so a failed load never lingers as stale data.
 */
import api, { unwrapList } from '@/lib/api'

// Fetches `url`, unwrapping the list into `setItems`; a cancelled request is left
// alone, a 404 clears the list without flagging setError, anything else clears
// the list AND flags setError.
export function fetchCalmList<T>(
  url: string,
  signal: AbortSignal | undefined,
  setItems: (rows: T[]) => void,
  setError: (v: boolean) => void,
): Promise<void> {
  return api.get(url, { signal }).then(res => setItems(unwrapList<T>(res).rows))
    .catch(err => {
      if (err?.code === 'ERR_CANCELED') return
      if (err?.response?.status !== 404) setError(true)
      setItems([])
    })
}
