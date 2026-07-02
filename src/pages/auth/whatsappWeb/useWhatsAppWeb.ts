/**
 * useWhatsAppWeb — manages the logged-in user's personal WhatsApp Web device
 * links. All logic (loading, polling, mutations) lives here so the components
 * stay presentational.
 *
 * Multi-device contract — the list response carries a `data[]` of devices:
 *   GET    /profile/whatsapp-web                 -> { data: [ { id, status, qr?, phone? } ] }
 *   POST   /profile/whatsapp-web                 -> create a new device session
 *   POST   /profile/whatsapp-web/{id}/connect    -> { status: 'connecting' }  (QR arrives async)
 *   POST   /profile/whatsapp-web/{id}/disconnect -> { status: 'disconnected' }
 *   DELETE /profile/whatsapp-web/{id}            -> removes the device
 *
 * status ∈ disconnected | connecting | qr_pending | connected. Because connect()
 * only returns 'connecting', the QR and the final status arrive by polling GET
 * while any device is still in a transient state — driven here by React Query's
 * refetchInterval, which polls only while a device is transient and then settles (A-3).
 */
import { useCallback, useState } from 'react'
import type { AxiosResponse } from 'axios'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { TRANSIENT_STATUSES } from './statusMeta'
import type { WhatsAppDevice } from './statusMeta'

const POLL_MS = 3000
type Phase = 'loading' | 'ready' | 'error' | 'unavailable'
type DeviceId = WhatsAppDevice['id'] | 'new'

// True while a device is still connecting / awaiting a QR scan.
const isTransient = (d: WhatsAppDevice) => TRANSIENT_STATUSES.includes(d.status)

// Read the device array out of a list response (tolerates { data: [] } or a bare []).
function readList(res: AxiosResponse | undefined): WhatsAppDevice[] {
  const body = res?.data
  if (Array.isArray(body)) return body as WhatsAppDevice[]
  if (Array.isArray(body?.data)) return body.data as WhatsAppDevice[]
  return []
}

export function useWhatsAppWeb() {
  // busyId flags the row (or 'new') being mutated — UI state, not part of the cache.
  const [busyId, setBusyId] = useState<DeviceId | null>(null)

  // Device list. refetchInterval polls only while a device is still connecting/awaiting
  // a QR scan, then stops. A 404 = backend feature off (calm "unavailable"), so no retry.
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['whatsapp-web'],
    queryFn: async ({ signal }) => readList(await api.get('/profile/whatsapp-web', { signal })),
    refetchInterval: (query) => (query.state.data?.some(isTransient) ? POLL_MS : false),
    retry: false,
  })

  const devices = data ?? []
  // Coarse view phase from the query state. The error phase is gated on "never loaded"
  // (data === undefined) so a transient poll failure keeps the last known list on screen.
  const phase: Phase = isLoading
    ? 'loading'
    : isError && data === undefined
      ? ((error as { response?: { status?: number } })?.response?.status === 404 ? 'unavailable' : 'error')
      : 'ready'

  // Run a mutation: flag the row busy, perform it, then refetch so the UI reflects the
  // real server state (connect() in particular only returns 'connecting').
  const run = useCallback(async (id: DeviceId, fn: () => Promise<unknown>) => {
    setBusyId(id)
    try { await fn(); await refetch() }
    catch { /* the list reload reflects reality; nothing destructive to surface */ }
    finally { setBusyId(null) }
  }, [refetch])

  // Create a new device session; the user then links it from its card.
  const createDevice = useCallback(() => run('new', () => api.post('/profile/whatsapp-web')), [run])
  const connect      = useCallback((id: WhatsAppDevice['id']) => run(id, () => api.post(`/profile/whatsapp-web/${id}/connect`)), [run])
  const disconnect   = useCallback((id: WhatsAppDevice['id']) => run(id, () => api.post(`/profile/whatsapp-web/${id}/disconnect`)), [run])
  const remove       = useCallback((id: WhatsAppDevice['id']) => run(id, () => api.delete(`/profile/whatsapp-web/${id}`)), [run])

  // reload wraps refetch so callers keep a simple `() => Promise<void>` (was `load`).
  const reload = useCallback(async () => { await refetch() }, [refetch])

  return { devices, phase, busyId, reload, createDevice, connect, disconnect, remove }
}
