/**
 * useWaWebSendDevices — the WhatsApp Web devices a manual send can go out over
 * (WA-SEND-1, Danny 10-09 Q4: preselect the logged-in user's own device, the picker
 * lists branch devices as the fallback). Two reads, both configuration: the user's
 * own devices (GET /profile/whatsapp-web, a status per device) decide the PRESELECT —
 * the first connected one — and GET /whatsapp-web-numbers?scope=usable (the connected
 * devices THIS caller may send from, own and branch, with scope + owner) feeds the picker. A hiccup on either
 * degrades to "no devices" rather than blocking the modal: the WABA path stays.
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { WhatsAppDevice } from '@/components/whatsappWeb/statusMeta'

// One picker option — GET /whatsapp-web-numbers' own row shape (value = device id).
export interface WaWebDeviceOption {
  value: string
  label: string
  scope?: 'user' | 'location'
  owner?: string | null
}

// Loads the caller's own connected device (the preselect) and every connected device the picker may offer.
export function useWaWebSendDevices() {
  const [devices, setDevices] = useState<WaWebDeviceOption[]>([])
  const [ownId, setOwnId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      api.get('/profile/whatsapp-web').then(r => unwrapList<WhatsAppDevice>(r).rows).catch(() => [] as WhatsAppDevice[]),
      // DANNY-AVOND-BE-1 round 3 (CMBE c253fac6): the bare roster is the workflow builder's
      // (every connected device, a colleague's too); the manual picker asks for the narrower
      // `usable` set — only a device this caller may actually send from. [] = nothing usable.
      api.get('/whatsapp-web-numbers?scope=usable').then(r => unwrapList<WaWebDeviceOption>(r).rows).catch(() => [] as WaWebDeviceOption[]),
    ]).then(([own, all]) => {
      if (!alive) return
      const connected = own.find(d => d.status === 'connected')
      setOwnId(connected ? String(connected.id) : null)
      setDevices(all.map(d => ({ ...d, value: String(d.value) })))
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return { devices, ownId, loading }
}
