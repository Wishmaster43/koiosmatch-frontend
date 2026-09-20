/**
 * useGeocodePoll (GEO-POLL-1, Danny 10-09 12:35, verbatim: "the screen must refresh
 * itself once the update is done, without needing cmd+r") — the ONE background
 * poll behind every OpenCage card. A manual re-geocode answers 202 (queued: a workflow
 * run since GEO-WORKFLOW-ALL-1). Measured on yesway 10-09: the run called OpenCage ~15 s
 * after the click, while the candidate tab's own loop gave up after 11 s, so the card sat
 * on "Not geocoded yet" until a reload. Rule: poll until the result lands or an
 * honest cap, with backoff — never a window sized to yesterday's latency — and resume on
 * mount while a request is still open, so a tab switch never loses the update.
 *
 * Carries the earlier lessons: GEO-LATLNG-1 (the 202 means queued — the trigger stops
 * its spinner before this poll runs), GEO-REFRESH-2 (always ADOPT what arrives: a
 * re-geocode of the same address keeps the pin but bumps the provenance), GEO-REFRESH-2b
 * (the host merges the landed values into the page record via onLanded so list, map and
 * other tabs update in place), PDOK-REFRESH-3 (the alive guard is re-armed in the effect
 * SETUP: StrictMode runs setup → cleanup → setup in dev).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import { toCoord } from '@/lib/coords'

export interface GeocodeMeta {
  requestedAt: string | null
  requestedBy: string | null
  updatedAt: string | null
}

export interface GeocodeSnapshot {
  lat: number | null
  lng: number | null
  geocode: GeocodeMeta | null
}

interface RawGeocodeRecord {
  lat?: unknown
  lng?: unknown
  geocode?: { requested_at?: string | null; requested_by?: string | null; updated_at?: string | null } | null
}

interface UseGeocodePollOptions {
  /** GET route of the record (e.g. `/candidates/{id}`); null when the entity has no per-id read, which disables polling. */
  fetchEndpoint: string | null
  /** The record's own values — the effective values fall back to these until a poll lands. */
  base: GeocodeSnapshot
  /** Called once with the landed values so the host merges them into the page record (GEO-REFRESH-2b). */
  onLanded?: (patch: GeocodeSnapshot) => void
}

export interface GeocodePoll extends GeocodeSnapshot {
  polling: boolean
  /** Start (or restart) the background poll after a queued (202) geocode request. */
  start: () => void
  /** Adopt an inline result (a route that answered with coordinates right away). */
  adopt: (patch: GeocodeSnapshot) => void
}

// Backoff ≈ 3 minutes over 15 reads: generous for a queue that sleeps and an engine that
// walks steps, bounded so a same-pin re-geocode stops burning requests.
export const GEOCODE_POLL_DELAYS_MS = [2000, 2000, 3000, 4000, 5000, 6000, 8000, 10000, 10000, 15000, 15000, 20000, 20000, 30000, 30000]
// A request older than this is not resumed on mount: it failed server-side (a 402 from
// the provider, say) and polling it again on every open would never land anything.
const GEOCODE_RESUME_WINDOW_MS = 10 * 60 * 1000

// Server → snapshot: coordinates tolerant of Laravel decimal strings (§10), provenance in camelCase.
function readSnapshot(raw: RawGeocodeRecord | null | undefined): GeocodeSnapshot {
  const meta = raw?.geocode
  return {
    lat: toCoord(raw?.lat),
    lng: toCoord(raw?.lng),
    geocode: meta ? { requestedAt: meta.requested_at ?? null, requestedBy: meta.requested_by ?? null, updatedAt: meta.updated_at ?? null } : null,
  }
}

// A request is still open when it was stamped after the last written coordinates (or never answered) and is recent.
export function isGeocodePending(meta: GeocodeMeta | null | undefined, now = Date.now()): boolean {
  if (!meta?.requestedAt) return false
  const requested = Date.parse(meta.requestedAt)
  if (Number.isNaN(requested) || now - requested > GEOCODE_RESUME_WINDOW_MS) return false
  return !meta.updatedAt || requested > Date.parse(meta.updatedAt)
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Polls the record's GET route with backoff after a queued geocode until the write lands (a fresh stamp, or changed coordinates), resuming on mount while a request is still open.
export function useGeocodePoll({ fetchEndpoint, base, onLanded }: UseGeocodePollOptions): GeocodePoll {
  const [fresh, setFresh] = useState<GeocodeSnapshot | null>(null)
  const [polling, setPolling] = useState(false)
  const aliveRef = useRef(true)
  // A new start (or an unmount) invalidates the loop that is still sleeping.
  const generationRef = useRef(0)
  const resumedRef = useRef(false)
  // Latest props for the sleeping loop, written after render (never during: react-hooks/refs).
  const baseRef = useRef(base)
  const onLandedRef = useRef(onLanded)
  useEffect(() => { baseRef.current = base; onLandedRef.current = onLanded })

  // PDOK-REFRESH-3: re-armed in the SETUP, never cleanup-only; the cleanup also forgets the
  // resume so StrictMode's second setup restarts a loop the first cleanup just cancelled.
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false; generationRef.current += 1; resumedRef.current = false }
  }, [])

  const start = useCallback(() => {
    if (!fetchEndpoint) return
    const generation = ++generationRef.current
    const startedFrom = baseRef.current
    setPolling(true)
    void (async () => {
      for (const delayMs of GEOCODE_POLL_DELAYS_MS) {
        await sleep(delayMs)
        if (!aliveRef.current || generation !== generationRef.current) return
        try {
          const next = readSnapshot(unwrap<RawGeocodeRecord>(await api.get(fetchEndpoint)))
          if (!aliveRef.current || generation !== generationRef.current) return
          setFresh(prev => ({
            lat: next.lat ?? prev?.lat ?? null,
            lng: next.lng ?? prev?.lng ?? null,
            geocode: next.geocode ?? prev?.geocode ?? null,
          }))
          // Landed = a fresh write stamp when the record carries provenance, else coordinates that changed.
          const landed = next.geocode?.updatedAt
            ? next.geocode.updatedAt !== (startedFrom.geocode?.updatedAt ?? null)
            : next.lat != null && next.lng != null && (next.lat !== startedFrom.lat || next.lng !== startedFrom.lng)
          if (landed) {
            onLandedRef.current?.(next)
            setPolling(false)
            return
          }
        } catch {
          // A failed read keeps the last-known values; the trigger already reported "started".
        }
      }
      setPolling(false)
    })()
  }, [fetchEndpoint])

  // Resume once per mount while a request is still open — a tab switch mid-request never loses the update.
  useEffect(() => {
    if (resumedRef.current || !isGeocodePending(base.geocode)) return
    resumedRef.current = true
    start()
  }, [base.geocode, start])

  const adopt = useCallback((patch: GeocodeSnapshot) => {
    generationRef.current += 1
    setPolling(false)
    setFresh(patch)
    onLandedRef.current?.(patch)
  }, [])

  return {
    lat: fresh?.lat ?? base.lat,
    lng: fresh?.lng ?? base.lng,
    geocode: fresh?.geocode ?? base.geocode,
    polling,
    start,
    adopt,
  }
}
