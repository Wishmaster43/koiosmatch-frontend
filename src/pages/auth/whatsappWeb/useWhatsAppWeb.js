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
 * while any device is still in a transient state.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../../lib/api'
import { TRANSIENT_STATUSES } from './statusMeta'

const POLL_MS = 3000
const isTransient = (d) => TRANSIENT_STATUSES.includes(d?.status)

// Read the device array out of a list response (tolerates { data: [] } or a bare []).
function readList(res) {
  const body = res?.data
  if (Array.isArray(body)) return body
  if (Array.isArray(body?.data)) return body.data
  return []
}

export function useWhatsAppWeb() {
  // Devices + the coarse view phase; busyId flags the row (or 'new') being mutated.
  const [devices, setDevices] = useState([])
  const [phase, setPhase]     = useState('loading') // loading | ready | error | unavailable
  const [busyId, setBusyId]   = useState(null)
  const pollRef = useRef(null)

  // Fetch the device list. A 404 means the backend feature is off → calm "unavailable".
  const load = useCallback(async (signal) => {
    try {
      const res = await api.get('/profile/whatsapp-web', { signal })
      setDevices(readList(res))
      setPhase('ready')
    } catch (e) {
      if (e?.code === 'ERR_CANCELED') return
      setPhase(e?.response?.status === 404 ? 'unavailable' : 'error')
    }
  }, [])

  // Initial load, cancelled on unmount.
  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  // Poll the list while any device is connecting / awaiting a QR scan; stop once
  // everything has settled. One interval, refreshed whenever the device set changes.
  useEffect(() => {
    clearInterval(pollRef.current)
    if (!devices.some(isTransient)) return
    pollRef.current = setInterval(async () => {
      try { setDevices(readList(await api.get('/profile/whatsapp-web'))) }
      catch { /* keep the last known state; retry next tick */ }
    }, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [devices])

  // Stop polling for good when the hook unmounts.
  useEffect(() => () => clearInterval(pollRef.current), [])

  // Run a mutation: flag the row busy, perform it, then refetch so the UI reflects
  // the real server state (connect() in particular only returns 'connecting').
  const run = useCallback(async (id, fn) => {
    setBusyId(id)
    try { await fn(); await load() }
    catch { /* the list reload reflects reality; nothing destructive to surface */ }
    finally { setBusyId(null) }
  }, [load])

  // Create a new device session; the user then links it from its card.
  const createDevice = useCallback(() => run('new', () => api.post('/profile/whatsapp-web')), [run])
  const connect      = useCallback((id) => run(id, () => api.post(`/profile/whatsapp-web/${id}/connect`)), [run])
  const disconnect   = useCallback((id) => run(id, () => api.post(`/profile/whatsapp-web/${id}/disconnect`)), [run])
  const remove       = useCallback((id) => run(id, () => api.delete(`/profile/whatsapp-web/${id}`)), [run])

  return { devices, phase, busyId, reload: load, createDevice, connect, disconnect, remove }
}
