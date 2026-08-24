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
  // WHATSAPP-LOG-MEERLADEN-1 (K-176, LIVE) — retention is unlimited; the first
  // page is only the 90-day window. `loadingMore` drives the button state,
  // `exhausted` renders the "no more" notice once a page comes back empty.
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const [messagesExhausted,   setMessagesExhausted]   = useState(false)

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

    setMessagesExhausted(false)
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

  // K-176 (live: f9cf1a64) — cursor page back from the oldest currently loaded
  // `sent_at`, dedup on id. End-of-archive comes from the server's own
  // `has_older` signal — NEVER from page size or an empty page (a filter slice
  // can be short while older rows still exist).
  const loadMoreMessages = () => {
    if (loadingMoreMessages || messagesExhausted || messages.length === 0) return
    const oldest = messages.reduce((min, m) => (m.sent_at && (!min || m.sent_at < min) ? m.sent_at : min), '' as string)
    if (!oldest) return
    setLoadingMoreMessages(true)
    api.get('/whatsapp/messages', { params: { per_page: 50, before: oldest } })
      .then(r => {
        const older = unwrapList<WaMessage>(r).rows
        // has_older sits next to data/meta in the response body.
        const hasOlder = (r?.data as { has_older?: boolean } | undefined)?.has_older
        if (hasOlder === false) setMessagesExhausted(true)
        if (older.length) {
          setMessages(prev => {
            const knownIds = new Set(prev.map(m => m.id))
            return [...prev, ...older.filter(m => !knownIds.has(m.id))]
          })
        }
      })
      .catch(() => setErrors(p => ({ ...p, messages: true })))
      .finally(() => setLoadingMoreMessages(false))
  }

  return {
    stats, messages, escalations, activity, loading, errors, lastRefresh, noConnection, reload,
    loadMoreMessages, loadingMoreMessages, messagesExhausted,
  }
}
