/**
 * fetchAbortableList — the shared "GET a customer sub-resource list, aborted on
 * a fast customerId switch, a real failure flags error, a cancelled request is
 * silently ignored" fetch body behind useCustomerContacts/useCustomerLocations/
 * useCustomerDepartments/usePriceAgreements' own `load` callbacks (Audit r4, §9:
 * a fast id switch must never let the previous customer's stale response win).
 * The caller still owns `setLoading` around the call (its own finally/needs vary).
 */
import type { AxiosResponse } from 'axios'
import api from '@/lib/api'

export function fetchAbortableList<T>(
  url: string,
  signal: AbortSignal | undefined,
  mapRows: (res: AxiosResponse) => T,
  setItems: (v: T) => void,
  setError: (v: boolean) => void,
): Promise<void> {
  return api.get(url, { signal })
    .then(res => { if (!signal?.aborted) setItems(mapRows(res)) })
    .catch(err => { if (err?.code !== 'ERR_CANCELED' && !signal?.aborted) setError(true) })
}
