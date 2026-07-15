/**
 * useWhatsAppData — the data layer for WhatsAppPage (§3): loads the four
 * dashboard sources in parallel (stats / messages / escalations / activity),
 * each with its own loading flag, and exposes a `reload` for the refresh button.
 * A 404 on /whatsapp/stats means "no connection" (handled by the page), not an
 * error; the other sources degrade to an empty list.
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { WaStats, WaMessage, WaEscalation, WaActivityDatum } from '@/types/whatsapp'

interface WaLoading { stats: boolean; messages: boolean; escalations: boolean; activity: boolean }

export function useWhatsAppData() {
  const [stats,         setStats]         = useState<WaStats | null>(null)
  const [messages,      setMessages]      = useState<WaMessage[]>([])
  const [escalations,   setEscalations]   = useState<WaEscalation[]>([])
  const [activity,      setActivity]      = useState<WaActivityDatum[]>([])
  const [loading,       setLoading]       = useState<WaLoading>({ stats: true, messages: true, escalations: true, activity: true })
  const [lastRefresh,   setLastRefresh]   = useState(new Date())
  const [noConnection,  setNoConnection]  = useState(false)

  // Refresh all four sources; a 404 on stats flags "no connection", others soft-fail.
  const reload = () => {
    setLoading({ stats: true, messages: true, escalations: true, activity: true })
    setNoConnection(false)

    api.get('/whatsapp/stats')
      .then(r => setStats(r.data))
      .catch(err => { if (err.response?.status === 404) setNoConnection(true) })
      .finally(() => setLoading(p => ({ ...p, stats: false })))

    api.get('/whatsapp/messages', { params: { per_page: 50 } })
      .then(r => setMessages(unwrapList<WaMessage>(r).rows))
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, messages: false })))

    api.get('/whatsapp/escalations')
      .then(r => setEscalations(unwrapList<WaEscalation>(r).rows))
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, escalations: false })))

    api.get('/whatsapp/activity')
      .then(r => setActivity(unwrapList<WaActivityDatum>(r).rows))
      .catch(() => {})
      .finally(() => setLoading(p => ({ ...p, activity: false })))

    setLastRefresh(new Date())
  }

  useEffect(() => { reload() }, [])

  return { stats, messages, escalations, activity, loading, lastRefresh, noConnection, reload }
}
