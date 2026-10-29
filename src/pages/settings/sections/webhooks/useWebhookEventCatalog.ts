/**
 * useWebhookEventCatalog — the ONE React Query wrapper around GET /webhook-events
 * (SETTINGS-WEBHOOK-EVENTS-DUP-1). The backend catalogue (`config/webhooks.php`,
 * served by `WebhookEventController::index`) is the live source of truth; the
 * static EVENT_GROUPS in `./webhookEvents` is kept ONLY as the network-error
 * fallback (never the default — see that file's own docblock). Every consumer
 * (EventCatalog, WebhookCreate, WebhookDetail) shares this cache.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { EVENT_GROUPS as FALLBACK_EVENT_GROUPS } from './webhookEvents'
import type { WebhookEventGroup } from './webhookEvents'

// Hand-written: the spec carries no 2xx schema for GET /webhook-events.
export interface WebhookEventItem { key: string; label?: string; group: string; pii?: boolean; fields?: string[] }
export interface WebhookEventMeta { pii: boolean; fields: string[] }

export const WEBHOOK_EVENT_CATALOG_QUERY_KEY = ['webhook-events']

// Fetch the flat event catalog: [{ key, label, group, pii, fields }, ...] — `fields` is the
// allow-list of payload keys that may leave for that event (ONIX G-002, BE lane D f0855053).
const fetchWebhookEventCatalog = (): Promise<WebhookEventItem[]> => api.get('/webhook-events').then(unwrap) as Promise<WebhookEventItem[]>

// Groups a flat [{ key, group }] list into [{ group, events: [key, ...] }],
// preserving first-seen group order (mirrors the backend's own list order).
function groupEvents(flat: WebhookEventItem[]): WebhookEventGroup[] {
  const order: string[] = []
  const byGroup = new Map<string, string[]>()
  for (const ev of flat) {
    if (!byGroup.has(ev.group)) { byGroup.set(ev.group, []); order.push(ev.group) }
    byGroup.get(ev.group)!.push(ev.key)
  }
  return order.map((group) => ({ group, events: byGroup.get(group) ?? [] }))
}

// Live catalogue, grouped the same shape as the static fallback (EVENT_GROUPS);
// on a network error it hands back the static list instead, flagged via `isFallback`
// so a consumer can say so rather than pretend it is live.
export function useWebhookEventCatalog() {
  const query = useQuery({
    queryKey: WEBHOOK_EVENT_CATALOG_QUERY_KEY,
    queryFn: fetchWebhookEventCatalog,
    staleTime: 5 * 60 * 1000,
  })

  const flat = Array.isArray(query.data) ? query.data : null
  // Stable identity on both paths — EventCatalog memoises its filtered view on
  // `groups`, which would silently stop memoising on the live path otherwise.
  const groups = useMemo(() => (flat ? groupEvents(flat) : FALLBACK_EVENT_GROUPS), [flat])
  // Per-event meta for the picker's hover text: { pii, fields } keyed by event key; empty on
  // the static fallback (it carries keys only), so a consumer renders nothing extra there.
  const meta = useMemo(() => {
    const out: Record<string, WebhookEventMeta> = {}
    for (const ev of flat ?? []) out[ev.key] = { pii: ev.pii === true, fields: Array.isArray(ev.fields) ? ev.fields : [] }
    return out
  }, [flat])
  const isFallback = !flat && query.isError

  return {
    groups,
    meta,
    events: flat,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback,
  }
}
