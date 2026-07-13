/**
 * heavyGet — guarded GET for the expensive aggregate endpoints (/dashboard,
 * /dashboard/charts, /candidates/stats, /opportunities/stats). The FE half of
 * the 13-07 outage prevention (PERF-DASH-1): piled-up refetches on a hanging
 * dashboard drained the whole PHP-FPM pool and took the login down with it.
 *
 * Two protections:
 * 1. In-flight DEDUP — identical concurrent GETs share one request (StrictMode
 *    double-mounts and multi-widget pages fired duplicates of /dashboard).
 * 2. Failure COOLDOWN — after a timeout/5xx the endpoint is not re-hit for an
 *    exponentially growing window (15s → 30s → 60s → 120s cap), so a slow
 *    query can never be hammered by re-renders or filter clicks. 4xx passes
 *    through untouched (that is an answer, not an outage).
 */
import api from './api'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'

const inflight = new Map<string, Promise<AxiosResponse>>()
const cooldown = new Map<string, { failures: number; blockedUntil: number }>()

// Stable key: url + sorted flat params (heavy endpoints only use flat params).
const keyOf = (url: string, params?: Record<string, unknown>) =>
  url + '?' + JSON.stringify(params ?? {}, Object.keys(params ?? {}).sort())

// Outage-shaped failure: no response at all (timeout/network) or a 5xx.
const isOutage = (e: unknown) => {
  const status = (e as { response?: { status?: number } })?.response?.status
  return !status || status >= 500
}

/** Error thrown while an endpoint is cooling down — callers fail soft on it. */
export class CooldownError extends Error {
  constructor(url: string) { super(`heavyGet cooldown: ${url}`); this.name = 'CooldownError' }
}

export function heavyGet(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
  const cd = cooldown.get(url)
  if (cd && Date.now() < cd.blockedUntil) return Promise.reject(new CooldownError(url))

  const key = keyOf(url, config.params as Record<string, unknown>)
  const existing = inflight.get(key)
  if (existing) return existing

  // The shared request drops per-caller abort signals on purpose: aborting one
  // subscriber must not kill the response for the others. Callers are fail-soft
  // (.catch(() => {})), so a late response after unmount is harmless.
  const rest = { ...config }
  delete rest.signal
  const p = api.get(url, rest)
    .then(res => { cooldown.delete(url); return res })
    .catch(e => {
      if (isOutage(e)) {
        const failures = (cooldown.get(url)?.failures ?? 0) + 1
        cooldown.set(url, { failures, blockedUntil: Date.now() + Math.min(15_000 * 2 ** (failures - 1), 120_000) })
      }
      throw e
    })
    .finally(() => { inflight.delete(key) })
  inflight.set(key, p)
  return p
}

/** Test hook: clear all guard state between test cases. */
export function _resetHeavyGet() { inflight.clear(); cooldown.clear() }
