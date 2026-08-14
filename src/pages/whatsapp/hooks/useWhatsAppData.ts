/**
 * useWhatsAppData — the data layer for WhatsAppPage (§3): loads the four
 * dashboard sources in parallel (stats / messages / escalations / activity),
 * each with its own loading flag, and exposes a `reload` for the refresh button.
 * A 404 on /whatsapp/stats means "no connection" (handled by the page), not an
 * error.
 *
 * WA-KPI9-1: messages/escalations/activity used to swallow every failure into a
 * silent empty array — fine for the feed/list UI (an empty list already renders
 * its own "no data" state), but NOT fine for a KPI number derived from that array
 * (escalations-without-reply, today's inbound/outbound split): an empty array
 * from a failed request must render the house dash, never a real "0" (§0 no
 * fabricated numbers). `errors` exposes which of the three failed so the page can
 * tell "genuinely zero" apart from "we don't know".
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { WaStats, WaMessage, WaEscalation, WaActivityDatum } from '@/types/whatsapp'

interface WaLoading { stats: boolean; messages: boolean; escalations: boolean; activity: boolean }
interface WaErrors { messages: boolean; escalations: boolean; activity: boolean }

export function useWhatsAppData() {
  const [stats,         setStats]         = useState<WaStats | null>(null)
  const [messages,      setMessages]      = useState<WaMessage[]>([])
  const [escalations,   setEscalations]   = useState<WaEscalation[]>([])
  const [activity,      setActivity]      = useState<WaActivityDatum[]>([])
  const [loading,       setLoading]       = useState<WaLoading>({ stats: true, messages: true, escalations: true, activity: true })
  const [errors,        setErrors]        = useState<WaErrors>({ messages: false, escalations: false, activity: false })
  const [lastRefresh,   setLastRefresh]   = useState(new Date())
  const [noConnection,  setNoConnection]  = useState(false)

  // Refresh all four sources; a 404 on stats flags "no connection". The other
  // three still degrade to an empty list for the feed/list UI, but now also flag
  // `errors.<source>` so a KPI number built from that list can fall back to the
  // house dash instead of presenting the empty list's length as a real zero.
  const reload = () => {
    setLoading({ stats: true, messages: true, escalations: true, activity: true })
    setErrors({ messages: false, escalations: false, activity: false })
    setNoConnection(false)

    api.get('/whatsapp/stats')
      .then(r => setStats(r.data))
      .catch(err => { if (err.response?.status === 404) setNoConnection(true) })
      .finally(() => setLoading(p => ({ ...p, stats: false })))

    api.get('/whatsapp/messages', { params: { per_page: 50 } })
      .then(r => setMessages(unwrapList<WaMessage>(r).rows))
      .catch(() => setErrors(p => ({ ...p, messages: true })))
      .finally(() => setLoading(p => ({ ...p, messages: false })))

    api.get('/whatsapp/escalations')
      .then(r => setEscalations(unwrapList<WaEscalation>(r).rows))
      .catch(() => setErrors(p => ({ ...p, escalations: true })))
      .finally(() => setLoading(p => ({ ...p, escalations: false })))

    api.get('/whatsapp/activity')
      .then(r => setActivity(unwrapList<WaActivityDatum>(r).rows))
      .catch(() => setErrors(p => ({ ...p, activity: true })))
      .finally(() => setLoading(p => ({ ...p, activity: false })))

    setLastRefresh(new Date())
  }

  useEffect(() => { reload() }, [])

  return { stats, messages, escalations, activity, loading, errors, lastRefresh, noConnection, reload }
}
