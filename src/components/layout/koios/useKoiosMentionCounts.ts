/**
 * useKoiosMentionCounts — real tenant totals for the "@" mention categories
 * (Danny 13/7: "nummer moet matchen wat in tenant staat" — no more fake demo
 * counts like the old hardcoded "2.845 actief"). Fetched lazily — only once the
 * mention menu is first opened — and cached at module scope so re-opening the
 * menu (or remounting the panel) never re-fetches within the same browser
 * session. Every source fails soft: one broken/slow endpoint just leaves that
 * category without a desc line — it never blocks the others or the menu itself
 * (the menu always renders immediately; counts stream in after).
 */
import { useEffect, useState } from 'react'
import api, { unwrap, unwrapList } from '@/lib/api'
import { heavyGet } from '@/lib/heavyGet'

export interface KoiosMentionCounts {
  candidates?: number
  leads?: number
  applications?: number
  vacancies?: number
  matches?: number
  opportunities?: number
  tasks?: number
  customers?: number
  outreach?: number
}

// One cheap `per_page=1` list call → its `meta.total` (unwrapList already falls
// back to the row count for endpoints without pagination meta). Never throws.
async function fetchTotal(url: string): Promise<number | undefined> {
  try {
    const res = await api.get(url, { params: { per_page: 1 } })
    return unwrapList(res).total
  } catch {
    return undefined
  }
}

// Leads = candidates with no deployability status yet — the same "no status"
// bucket useCandidateOptions already derives from /candidates/stats.by_status
// (a lead, by invariant, never carries a status). There is no dedicated phase
// filter/endpoint yet (PHASE-FILTER-1, pending backend) so this is the best
// real signal available; if the shape ever changes the entry just shows no count.
async function fetchLeadsCount(): Promise<number | undefined> {
  try {
    const res = await heavyGet('/candidates/stats')
    const body = (unwrap(res) ?? null) as
      { by_status?: Array<{ value?: string; status?: string; count?: number }> } | null
    const bucket = body?.by_status?.find((o) => !(o.value ?? o.status))
    return typeof bucket?.count === 'number' ? bucket.count : undefined
  } catch {
    return undefined
  }
}

// Module-level cache: one fetch per browser session, shared by every mount —
// closing/reopening the panel or the "@" menu must never re-poll the tenant.
let cache: Promise<KoiosMentionCounts> | null = null

// Fire all cheap totals in parallel; Bellijsten (outreach) reuses the same
// paginated /outreach-campaigns list the page itself lists from.
function loadCounts(): Promise<KoiosMentionCounts> {
  return Promise.all([
    fetchTotal('/candidates'),
    fetchLeadsCount(),
    fetchTotal('/applications'),
    fetchTotal('/vacancies'),
    fetchTotal('/matches'),
    fetchTotal('/opportunities'),
    fetchTotal('/tasks'),
    fetchTotal('/customers'),
    fetchTotal('/outreach-campaigns'),
  ]).then(([candidates, leads, applications, vacancies, matches, opportunities, tasks, customers, outreach]) => ({
    candidates, leads, applications, vacancies, matches, opportunities, tasks, customers, outreach,
  }))
}

export function useKoiosMentionCounts(enabled: boolean): KoiosMentionCounts {
  const [counts, setCounts] = useState<KoiosMentionCounts>({})

  // Kick off the (session-cached) fetch the first time the menu opens; stream
  // the resolved totals in without ever blocking the menu's first paint.
  useEffect(() => {
    if (!enabled) return
    cache ??= loadCounts()
    let alive = true
    cache.then((c) => { if (alive) setCounts(c) })
    return () => { alive = false }
  }, [enabled])

  return counts
}
