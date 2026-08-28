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
import { useState, useEffect, useRef } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { WaStats, WaMessage, WaEscalation, WaActivityDatum } from '@/types/whatsapp'

interface WaLoading { stats: boolean; messages: boolean; escalations: boolean; activity: boolean }
interface WaErrors { messages: boolean; escalations: boolean; activity: boolean }

// Full K-194 server-side message filter set (WA-MSG-TABLE-1 → stage B, 25-08):
// the right-panel groups feed this object straight into GET /whatsapp/messages'
// query params. `direction`/`status` stay single-value (the endpoint validates
// them as SCALARS, `in:...` — never a list); every other axis is a real array
// per the contract (getWhatsappMessages in api-generated.ts).
export interface WaMessageFilters {
  direction?: string[]
  status?: string[]
  type?: string[]
  priority?: boolean
  purpose?: string[]
  template?: string[]
  owner?: string[]
  number?: string[]
  channel?: string[]
  from?: string
  to?: string
  sort?: 'asc' | 'desc'
}

// The WhatsApp screen's whole data layer: stats, messages (with older-page loading), escalations and activity, each with its own error state.
export function useWhatsAppData(filters: WaMessageFilters = {}) {
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
  // §9 unmount/race guards: an alive flag dropped on unmount, plus a per-source
  // request-id so a fast filter toggle / reload can't let a stale response win
  // over a newer one that already landed.
  const aliveRef = useRef(true)
  const messagesReqRef = useRef(0)
  const statsReqRef = useRef(0)
  const escalationsReqRef = useRef(0)
  const activityReqRef = useRef(0)
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false } }, [])

  // WA-MSG-TABLE-1 FIX (26-08): WhatsappDashboardController validates direction/
  // status as SCALARS (`in:inbound,outbound` / `in:sent,delivered,read,failed,
  // received`), never a comma-joined list — a joined value 422s. The right-panel
  // groups are therefore `type: 'radio'` (single-select, §3A "every filter in
  // the right panel" — a radio group is still a filter group, just single-value),
  // so at most one direction and one status are ever selected; take that single
  // value, never join.
  const directionValue = filters.direction?.[0]
  const statusValue    = filters.status?.[0]
  // Build the full param object exactly as the contract names each key —
  // arrays sent as arrays, `priority` as a real boolean, omitted when empty/unset
  // so an idle filter never appears as `[]`/`undefined` on the wire.
  const messageParams = () => ({
    per_page: 50,
    ...(directionValue ? { direction: directionValue } : {}),
    ...(statusValue ? { status: statusValue } : {}),
    ...(filters.type?.length ? { type: filters.type } : {}),
    // Laravel's boolean rule rejects the string "true" a JS boolean serialises to: send 1/0.
    ...(filters.priority !== undefined ? { priority: filters.priority ? 1 : 0 } : {}),
    ...(filters.purpose?.length ? { purpose: filters.purpose } : {}),
    ...(filters.template?.length ? { template: filters.template } : {}),
    ...(filters.owner?.length ? { owner: filters.owner } : {}),
    ...(filters.number?.length ? { number: filters.number } : {}),
    ...(filters.channel?.length ? { channel: filters.channel } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.sort ? { sort: filters.sort } : {}),
  })

  // Re-fetch ONLY the messages source, with the current direction/status params.
  // Split out from `reload()` (WA-MSG-TABLE-1 FIX, 26-08) so a right-panel
  // filter toggle no longer refetches stats/escalations/activity too — those
  // three don't depend on these filters, and re-requesting them on every
  // toggle wasted three calls and flickered the KPI band's loading state.
  const reloadMessages = () => {
    const reqId = ++messagesReqRef.current
    setMessagesExhausted(false)
    setLoading(p => ({ ...p, messages: true }))
    setErrors(p => ({ ...p, messages: false }))
    api.get('/whatsapp/messages', { params: messageParams() })
      .then(r => { if (aliveRef.current && reqId === messagesReqRef.current) setMessages(unwrapList<WaMessage>(r).rows) })
      .catch(() => { if (aliveRef.current && reqId === messagesReqRef.current) setErrors(p => ({ ...p, messages: true })) })
      .finally(() => { if (aliveRef.current && reqId === messagesReqRef.current) setLoading(p => ({ ...p, messages: false })) })
  }

  // Refresh all four sources; a 404 on stats flags "no connection". The other
  // three still degrade to an empty list for the feed/list UI, but now also flag
  // `errors.<source>` so a KPI number built from that list can fall back to the
  // house dash instead of presenting the empty list's length as a real zero.
  const reload = () => {
    setLoading({ stats: true, messages: true, escalations: true, activity: true })
    setErrors({ messages: false, escalations: false, activity: false })
    setNoConnection(false)

    const statsReqId = ++statsReqRef.current
    api.get('/whatsapp/stats')
      .then(r => { if (aliveRef.current && statsReqId === statsReqRef.current) setStats(r.data) })
      .catch(err => { if (aliveRef.current && statsReqId === statsReqRef.current && err.response?.status === 404) setNoConnection(true) })
      .finally(() => { if (aliveRef.current && statsReqId === statsReqRef.current) setLoading(p => ({ ...p, stats: false })) })

    setMessagesExhausted(false)
    const messagesReqId = ++messagesReqRef.current
    api.get('/whatsapp/messages', { params: messageParams() })
      .then(r => { if (aliveRef.current && messagesReqId === messagesReqRef.current) setMessages(unwrapList<WaMessage>(r).rows) })
      .catch(() => { if (aliveRef.current && messagesReqId === messagesReqRef.current) setErrors(p => ({ ...p, messages: true })) })
      .finally(() => { if (aliveRef.current && messagesReqId === messagesReqRef.current) setLoading(p => ({ ...p, messages: false })) })

    const escalationsReqId = ++escalationsReqRef.current
    api.get('/whatsapp/escalations')
      .then(r => { if (aliveRef.current && escalationsReqId === escalationsReqRef.current) setEscalations(unwrapList<WaEscalation>(r).rows) })
      .catch(() => { if (aliveRef.current && escalationsReqId === escalationsReqRef.current) setErrors(p => ({ ...p, escalations: true })) })
      .finally(() => { if (aliveRef.current && escalationsReqId === escalationsReqRef.current) setLoading(p => ({ ...p, escalations: false })) })

    const activityReqId = ++activityReqRef.current
    api.get('/whatsapp/activity')
      .then(r => { if (aliveRef.current && activityReqId === activityReqRef.current) setActivity(unwrapList<WaActivityDatum>(r).rows) })
      .catch(() => { if (aliveRef.current && activityReqId === activityReqRef.current) setErrors(p => ({ ...p, activity: true })) })
      .finally(() => { if (aliveRef.current && activityReqId === activityReqRef.current) setLoading(p => ({ ...p, activity: false })) })

    setLastRefresh(new Date())
  }

  // Mount: load all four sources once.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount only, deliberately
  useEffect(() => { reload() }, [])

  // Refetch ONLY messages when the caller's filters change — `didMount` skips the
  // redundant call on first render (the mount effect above already fetched messages
  // once with these same initial filter values). A stringified signature covers the
  // full filter object (arrays included) without re-running on every render for a
  // fresh-but-equal array/object reference from the caller.
  const filtersSignature = JSON.stringify(filters)
  const didMount = useRef(false)
  // Reload messages when the filters actually change, skipping the first run so the mount effect's own fetch isn't duplicated.
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    reloadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadMessages is redefined every render (not memoized), only the signature matters here
  }, [filtersSignature])

  // K-176 (live: f9cf1a64) — cursor page back from the oldest currently loaded
  // `sent_at`, dedup on id. End-of-archive comes from the server's own
  // `has_older` signal — NEVER from page size or an empty page (a filter slice
  // can be short while older rows still exist).
  const loadMoreMessages = () => {
    if (loadingMoreMessages || messagesExhausted || messages.length === 0) return
    const oldest = messages.reduce((min, m) => (m.sent_at && (!min || m.sent_at < min) ? m.sent_at : min), '' as string)
    if (!oldest) return
    setLoadingMoreMessages(true)
    const reqId = ++messagesReqRef.current
    api.get('/whatsapp/messages', { params: { ...messageParams(), before: oldest } })
      .then(r => {
        if (!aliveRef.current || reqId !== messagesReqRef.current) return // superseded by a newer reload/filter change
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
      .catch(() => { if (aliveRef.current && reqId === messagesReqRef.current) setErrors(p => ({ ...p, messages: true })) })
      .finally(() => { if (aliveRef.current && reqId === messagesReqRef.current) setLoadingMoreMessages(false) })
  }

  return {
    stats, messages, escalations, activity, loading, errors, lastRefresh, noConnection, reload,
    loadMoreMessages, loadingMoreMessages, messagesExhausted,
  }
}
