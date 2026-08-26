/**
 * useWhatsAppWeb — manages a set of WhatsApp Web device links (K-193 fase 1 +
 * K-195). Generalised over `basePath` so it drives BOTH surfaces from one
 * implementation (VESTIGING-DEVICE-1, CMBE d88ad05e): the logged-in user's own
 * devices (Profile) and a tenant's branch devices (Settings). Row shape is
 * identical on both (`DeviceLifecycle::row`). All logic (loading, polling,
 * mutations) lives here so the components stay presentational.
 *
 * Contract, `basePath` = `/profile/whatsapp-web` (self-scoped, no extra
 * permission) or `/settings/whatsapp-web-numbers` (`settings.view`/`.update`):
 *   GET    {basePath}                 -> { data: [ device… ] }
 *   POST   {basePath} {body?}         -> create a new device (own devices: no
 *                                         body; branch devices: {location_id
 *                                         (required), label?, phone_number?})
 *   POST   {basePath}/{id}/connect    -> { status: 'connecting' } (QR arrives via webhook)
 *                                         501 when the gateway isn't configured
 *   POST   {basePath}/{id}/disconnect -> { status: 'disconnected' }
 *   DELETE {basePath}/{id}            -> removes the device
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

// Defaults to the profile surface — every existing caller/test stays byte-identical.
export function useWhatsAppWeb(basePath: string = '/profile/whatsapp-web') {
  // busyId flags the row (or 'new') being mutated — UI state, not part of the cache.
  const [busyId, setBusyId] = useState<DeviceId | null>(null)
  // notEnabled flags the device whose connect() came back 501 (gateway not configured).
  const [notEnabledId, setNotEnabledId] = useState<DeviceId | null>(null)

  // Device list. refetchInterval polls only while a device is still connecting/awaiting
  // a QR scan, then stops. A 403/404 = module/permission off (calm 'unavailable'), no retry.
  // Keyed on basePath so the two surfaces never share a cache entry.
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['whatsapp-web', basePath],
    queryFn: async ({ signal }) => readList(await api.get(basePath, { signal })),
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
  // Resolves true on success, false on failure (after a best-effort reload): the caller
  // shows the honest notice and keeps the user's input, never a silent "it worked".
  const run = useCallback(async (id: DeviceId, fn: () => Promise<unknown>): Promise<boolean> => {
    setBusyId(id)
    try { await fn(); await refetch(); return true }
    catch { await refetch().catch(() => undefined); return false }
    finally { setBusyId(null) }
  }, [refetch])

  // Create a new device session; the user then links it from its card. `body` is
  // omitted on the own-device surface (matches the pre-generalisation request
  // exactly) and carries {location_id, label?, phone_number?} on the branch surface.
  const createDevice = useCallback((body?: Record<string, unknown>) =>
    run('new', () => (body ? api.post(basePath, body) : api.post(basePath))), [run, basePath])

  // Connect: a 501 means the gateway isn't configured — surface it on the row
  // instead of letting run()'s catch swallow it silently.
  const connect = useCallback(async (id: WhatsAppDevice['id']) => {
    setNotEnabledId(null)
    setBusyId(id)
    try {
      await api.post(`${basePath}/${id}/connect`)
      await refetch()
    } catch (e) {
      if (statusOf(e) === 501) setNotEnabledId(id)
    } finally {
      setBusyId(null)
    }
  }, [refetch, basePath])

  // Disconnect this device; shares run()'s busy-tracking + error handling.
  const disconnect = useCallback((id: WhatsAppDevice['id']) => run(id, () => api.post(`${basePath}/${id}/disconnect`)), [run, basePath])
  // Remove this device entirely; shares run()'s busy-tracking + error handling.
  const remove      = useCallback((id: WhatsAppDevice['id']) => run(id, () => api.delete(`${basePath}/${id}`)), [run, basePath])

  return { devices, phase, busyId, notEnabledId, createDevice, connect, disconnect, remove }
}
