/**
 * useWhatsAppWeb — manages the logged-in user's personal WhatsApp Web device
 * links (K-193 fase 1). All logic (loading, polling, mutations) lives here so
 * the components stay presentational.
 *
 * Contract (module `whatsapp_web`, self-scoped — no extra permission needed):
 *   GET    /profile/whatsapp-web                 -> { data: [ device… ] }
 *   POST   /profile/whatsapp-web {label?,phone_number?} -> create a new device
 *   POST   /profile/whatsapp-web/{id}/connect    -> { status: 'connecting' } (QR arrives via webhook)
 *                                                    501 when the gateway isn't configured
 *   POST   /profile/whatsapp-web/{id}/disconnect -> { status: 'disconnected' }
 *   DELETE /profile/whatsapp-web/{id}            -> removes the device
 *
 * status ∈ disconnected | connecting | qr_pending | connected. Because connect()
 * only returns 'connecting', the QR and the final status arrive by polling GET
 * while any device is still transient — driven by React Query's refetchInterval,
 * which polls only while a device is transient and settles once none are (A-3).
 * A 403/404 on the list means the module/permission is off (calm 'unavailable',
 * not an error); a 501 from connect() means the gateway isn't configured and must
 * surface as a typed 'notEnabled' error on that device, never a silent catch.
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

// Pull the HTTP status off an axios-style error without leaking the rest.
const statusOf = (e: unknown) => (e as { response?: { status?: number } })?.response?.status

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
  // notEnabled flags the device whose connect() came back 501 (gateway not configured).
  const [notEnabledId, setNotEnabledId] = useState<DeviceId | null>(null)

  // Device list. refetchInterval polls only while a device is still connecting/awaiting
  // a QR scan, then stops. A 403/404 = module/permission off (calm 'unavailable'), no retry.
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
      ? ([403, 404].includes(statusOf(error) ?? 0) ? 'unavailable' : 'error')
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

  // Connect: a 501 means the gateway isn't configured — surface it on the row
  // instead of letting run()'s catch swallow it silently.
  const connect = useCallback(async (id: WhatsAppDevice['id']) => {
    setNotEnabledId(null)
    setBusyId(id)
    try {
      await api.post(`/profile/whatsapp-web/${id}/connect`)
      await refetch()
    } catch (e) {
      if (statusOf(e) === 501) setNotEnabledId(id)
    } finally {
      setBusyId(null)
    }
  }, [refetch])

  const disconnect = useCallback((id: WhatsAppDevice['id']) => run(id, () => api.post(`/profile/whatsapp-web/${id}/disconnect`)), [run])
  const remove      = useCallback((id: WhatsAppDevice['id']) => run(id, () => api.delete(`/profile/whatsapp-web/${id}`)), [run])

  return { devices, phase, busyId, notEnabledId, createDevice, connect, disconnect, remove }
}
