// chartHelpers — shared chart constants/utilities. Bucket/month labels are
// locale-aware: callers pass a `t` (for lookup buckets) or a `locale`
// (for Intl-formatted months), mirroring how src/lib/localDate.ts takes its
// locale explicitly rather than baking one language's strings into the module.

// Stable English keys for the fixed "last login" bucket order — the display
// label is resolved per-locale via t('report.loginGroups.<key>'), never hardcoded.
export const LOGIN_GROUP_KEYS = [
  'lt7', 'd8to14', 'd15to21', 'd22to30', 'd31to60', 'd61to90', 'gt90', 'never',
] as const
type LoginGroupKey = typeof LOGIN_GROUP_KEYS[number]

// A bucketed chart datum (category name + count).
export interface ChartDatum { name: string; value: number }
// A generic row with arbitrary fields (chart inputs come from many API shapes).
type Row = Record<string, unknown>
// Minimal shape needed from i18next's TFunction — just enough to translate a key.
type Translate = (key: string) => string

// Buckets a last-login timestamp into the fixed LOGIN_GROUP_KEYS order; a
// missing/empty value means the user has never logged in.
function getLoginGroupKey(lastLoginAt?: string | number | Date | null): LoginGroupKey {
  if (!lastLoginAt) return 'never'
  const days = Math.floor((Date.now() - new Date(lastLoginAt).getTime()) / 86400000)
  if (days <= 7)  return 'lt7'
  if (days <= 14) return 'd8to14'
  if (days <= 21) return 'd15to21'
  if (days <= 30) return 'd22to30'
  if (days <= 60) return 'd31to60'
  if (days <= 90) return 'd61to90'
  return 'gt90'
}

// Buckets a last-login timestamp into a translated bucket label for chart display.
export function getLoginGroup(lastLoginAt: string | number | Date | null | undefined, t: Translate): string {
  return t(`report.loginGroups.${getLoginGroupKey(lastLoginAt)}`)
}

// Translated, ordered login-group labels — pass as `order` to toChartData so
// categories keep the fixed lt7..never sequence rather than sorting by count.
export function getLoginGroupOrder(t: Translate): string[] {
  return LOGIN_GROUP_KEYS.map(key => t(`report.loginGroups.${key}`))
}

// Tallies items into named buckets via a key selector; an empty/missing key still
// counts under `unknownLabel` (caller-supplied, translated) instead of silently
// dropping the item from the total.
export function groupAndCount<T>(
  items: T[],
  keyFn: (item: T) => string | null | undefined,
  unknownLabel = 'Unknown',
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFn(item) || unknownLabel
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

// Turns a group-count map into chart rows. With an explicit order, categories keep
// that fixed order (and drop empty ones); otherwise the fallback sorts by count descending.
export function toChartData(grouped: Record<string, number>, order: string[] | null = null): ChartDatum[] {
  if (order) {
    return order.map(name => ({ name, value: grouped[name] || 0 })).filter(d => d.value > 0)
  }
  return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

// ISO week number (Thursday-anchored) used to bucket dates into "W<n>" chart categories.
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Buckets rows by month (optionally scoped to one year) using a sortable year-month
// key so the chart can order chronologically while still displaying the short month
// label in the caller's locale (Intl, never a hardcoded language's month names).
export function groupByMonth(items: Row[], year?: string | number | null, dateField = 'registration_date', locale = 'en'): ChartDatum[] {
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  const grouped: Record<string, ChartDatum> = {}
  items.forEach(c => {
    if (!c[dateField]) return
    const date = new Date(c[dateField] as string)
    if (year && date.getFullYear() !== parseInt(String(year))) return
    const sortKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}`
    const label   = monthFmt.format(date)
    if (!grouped[sortKey]) grouped[sortKey] = { name: label, value: 0 }
    grouped[sortKey].value++
  })
  return Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([,d]) => d)
}

// Buckets rows by ISO week number (optionally scoped to one year), sorted numerically
// by week rather than alphabetically so "W2" doesn't sort after "W10".
export function groupByWeek(items: Row[], year?: string | number | null, dateField = 'registration_date'): ChartDatum[] {
  const grouped: Record<string, number> = {}
  items.forEach(c => {
    if (!c[dateField]) return
    const date = new Date(c[dateField] as string)
    if (year && date.getFullYear() !== parseInt(String(year))) return
    const w = `W${getWeekNumber(date)}`
    grouped[w] = (grouped[w] || 0) + 1
  })
  return Object.entries(grouped)
    .sort(([a],[b]) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
    .map(([name, value]) => ({ name, value }))
}

// Collects the distinct years present in a date field, newest first, to populate a year filter.
export function getAvailableYears(items: Row[], dateField = 'registration_date'): number[] {
  return [...new Set(
    items.map(c => c[dateField] ? new Date(c[dateField] as string).getFullYear() : null)
      .filter((y): y is number => y != null)
  )].sort((a, b) => b - a)
}

// Groups then keeps only the top N buckets by count, for "top X" chart widgets that
// would otherwise be swamped by a long tail of one-off categories.
export function topN(items: Row[], keyFn: (item: Row) => string | null | undefined, n = 10, unknownLabel = 'Unknown'): ChartDatum[] {
  const grouped = groupAndCount(items, keyFn, unknownLabel)
  return Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([name, value]) => ({ name, value }))
}
