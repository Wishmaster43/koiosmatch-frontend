/**
 * Tolerant normalizers for the Koios dashboard reports (GET /ai/koios/for-you and
 * /ai/koios/performance). A malformed or empty 200 ({}) must degrade to the
 * empty state, never throw inside a card (four UI states canon).
 */

// A finite number or the fallback (counts may arrive as numeric strings).
function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

// A plain object of numeric counts; anything else becomes {}.
function countMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, c]) => [k, num(c)]))
}

// An array of plain objects; anything else becomes [].
function objectList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []
}

// One Koios-triggered action row (K-174); `created` is the record it made, or null when nothing resolvable.
export interface NormalizedForYouAction {
  id: string | number
  type: string
  source: string
  executed_at: string | null
  status: string
  // label is nullable on the wire: the linked record may be deleted after creation.
  created: { entity_type: string; entity_id: string | number; label: string | null } | null
}

// The full for-you report, hand-written (§10: no api-generated entry for this route yet).
export interface NormalizedForYouReport {
  from?: string
  to?: string
  period: string
  actions_total: number
  per_type: Record<string, number>
  per_source: Record<string, number>
  actions: NormalizedForYouAction[]
  actions_truncated: boolean
}

// Maps any for-you response body to a fully defaulted report.
export function normalizeForYouReport(raw: unknown): NormalizedForYouReport {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const actions = objectList(r.actions).map((a, i): NormalizedForYouAction => {
    const c = a.created && typeof a.created === 'object' ? (a.created as Record<string, unknown>) : null
    return {
      id: (typeof a.id === 'string' || typeof a.id === 'number' ? a.id : `missing-${i}`) as string,
      type: typeof a.type === 'string' ? a.type : '',
      source: typeof a.source === 'string' ? a.source : '',
      executed_at: typeof a.executed_at === 'string' ? a.executed_at : null,
      status: typeof a.status === 'string' ? a.status : '',
      created: c && c.entity_id != null
        ? { entity_type: String(c.entity_type ?? ''), entity_id: c.entity_id as string | number, label: typeof c.label === 'string' ? c.label : null }
        : null,
    }
  })
  return {
    from: typeof r.from === 'string' ? r.from : undefined,
    to: typeof r.to === 'string' ? r.to : undefined,
    period: typeof r.period === 'string' ? r.period : '',
    actions_total: num(r.actions_total),
    per_type: countMap(r.per_type),
    per_source: countMap(r.per_source),
    actions,
    actions_truncated: r.actions_truncated === true,
  }
}

// The performance report (K-181): executed split, top users and day trend.
export interface NormalizedPerformanceReport {
  executed: { completed: number; failed: number; other: number }
  top_users: { user_id: string | number; name: string; count: number }[]
  timeseries: { date: string; count: number }[]
}

// Maps any performance response body to a fully defaulted report.
export function normalizePerformanceReport(raw: unknown): NormalizedPerformanceReport {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const ex = (r.executed && typeof r.executed === 'object' ? r.executed : {}) as Record<string, unknown>
  return {
    executed: { completed: num(ex.completed), failed: num(ex.failed), other: num(ex.other) },
    top_users: objectList(r.top_users).map((u, i) => ({
      user_id: (typeof u.user_id === 'string' || typeof u.user_id === 'number' ? u.user_id : `missing-${i}`) as string | number,
      name: typeof u.name === 'string' ? u.name : '',
      count: num(u.count),
    })),
    timeseries: objectList(r.timeseries).map((p) => ({ date: typeof p.date === 'string' ? p.date : '', count: num(p.count) })),
  }
}
