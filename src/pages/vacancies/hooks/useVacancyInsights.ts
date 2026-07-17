/**
 * useVacancyInsights — the insights-row aggregate derivation for VacanciesPage (§3
 * size discipline: the page crossed ~400 lines, so this donut/KPI math — previously
 * four inline useMemo blocks — moves out, mirroring how useVacanciesData/
 * useVacancyRecord already extracted the data/record layers from this same page).
 * Pure derivation only: stats first (server-wide, filter-honouring), page-loaded
 * rows as the fallback — no fetching, no side effects.
 */
import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import { resolveStatusSegment } from '../data/vacanciesShared'
import type { VacancyLookupItem } from '@/context/VacancyLookupsContext'
import type { Vacancy } from '@/types/vacancy'
import type { Id } from '@/types/common'

interface Aggregate { name: string; key: string; color?: string; value: number }
interface VacancyStatsShape {
  // `label`/`color` (V27): the backend already resolves these itself (real tenant
  // name, or its own 'Onbekend'/'Geen status' copy) — used as a last-resort source
  // before the FE ever falls back to a distinct "unknown" label (never the raw uuid).
  by_status?: Array<{ value?: string; status?: string; count?: number; label?: string; color?: string }>
  by_owner?: Array<{ id?: Id; owner_id?: Id; name?: string; count?: number }>
  by_client?: Array<{ id?: Id; customer_id?: Id; name?: string; count?: number }>
  by_phase?: Array<{ value?: string; phase?: string; count?: number }> | Record<string, number>
}

interface Args {
  // Raw stats payload from useVacanciesData (Record<string, unknown> | null) — cast
  // to the shape this hook actually reads, same defensive-read stance as the rest
  // of the vacancy data layer (the /vacancies/stats endpoint is still settling).
  stats: Record<string, unknown> | null
  vacancies: Vacancy[]
  total: number
  statuses: VacancyLookupItem[]
  statusMeta: (v?: string | null) => VacancyLookupItem
  t: TFunction
}

export function useVacancyInsights({ stats, vacancies, total, statuses, statusMeta, t }: Args) {
  const s = stats as VacancyStatsShape | null
  // ── Donut data (status / owner / client / published) — stats first, page-derived fallback ──
  const statusData = useMemo<Aggregate[]>(() => {
    if (s?.by_status) {
      // Stats carry bare uuid's; resolve label/colour via the lookup OR the loaded rows
      // (the seed created two status sets — VAC-SEED-1 — so the lookup alone can miss).
      const rowMeta = new Map(vacancies.filter(v => v.statusValue).map(v => [String(v.statusValue), { label: v.statusLabel, color: v.statusColor }]))
      // V27 fix: a real (non-null) status id unresolved by BOTH the lookup and any
      // loaded row used to silently fall back to "Geen status" here, mislabelling
      // real (just-unresolved) statuses as no-status and inflating that bucket.
      return s.by_status.map(o => resolveStatusSegment(o, statusMeta, rowMeta, t('insights.noStatus'), t('insights.unknownStatus')))
    }
    return statuses.map(st => ({ name: st.label, key: st.value, color: st.color, value: vacancies.filter(v => v.statusValue === st.value).length })).filter(d => d.value > 0)
  }, [s, statuses, vacancies, statusMeta, t])

  // V27: Gepubliceerd/Niet-gepubliceerd donut. /vacancies/stats has no by_published
  // aggregate yet (mirrors by_status would need the same treatment — ticket filed),
  // so — same fallback owner/client already use when their stats slice is missing —
  // this counts the loaded page; `publishedNotice` below says so when that's partial.
  const publishedData = useMemo<Aggregate[]>(() => {
    const publishedCount = vacancies.filter(v => v.published).length
    const unpublishedCount = vacancies.length - publishedCount
    const out: Aggregate[] = []
    if (publishedCount > 0)   out.push({ name: t('publishedState.yes'), key: 'published',   color: 'var(--color-success)', value: publishedCount })
    if (unpublishedCount > 0) out.push({ name: t('publishedState.no'),  key: 'unpublished', color: '#9CA3AF',              value: unpublishedCount })
    return out
  }, [vacancies, t])

  const ownerData = useMemo<Aggregate[]>(() => {
    if (s?.by_owner) return s.by_owner.map(o => ({ name: o.name || '—', key: String(o.id ?? o.owner_id ?? ''), value: o.count ?? 0 })).filter(o => o.key !== '')
    const m: Record<string, Aggregate> = {}
    vacancies.forEach(v => { if (v.owner?.id != null) { const k = String(v.owner.id); (m[k] ??= { name: v.owner.name || '—', key: k, color: v.owner.color ?? undefined, value: 0 }).value++ } })
    return Object.values(m)
  }, [s, vacancies])

  const clientData = useMemo<Aggregate[]>(() => {
    if (s?.by_client) return s.by_client.map(o => ({ name: o.name || '—', key: String(o.id ?? o.customer_id ?? ''), value: o.count ?? 0 })).filter(o => o.key !== '')
    const m: Record<string, Aggregate> = {}
    vacancies.forEach(v => { if (v.clientId != null) { const k = String(v.clientId); (m[k] ??= { name: v.clientName || '—', key: k, value: 0 }).value++ } })
    return Object.values(m)
  }, [s, vacancies])

  // KPI cards = funnel-phase counts across applications.
  const phaseCounts = useMemo<Record<string, number>>(() => {
    if (s?.by_phase) {
      if (Array.isArray(s.by_phase)) return Object.fromEntries(s.by_phase.map(o => [o.value ?? o.phase, o.count ?? 0]))
      return s.by_phase
    }
    const acc: Record<string, number> = {}
    vacancies.forEach(v => Object.entries(v.applicationsByPhase ?? {}).forEach(([k, n]) => { acc[k] = (acc[k] ?? 0) + (Number(n) || 0) }))
    return acc
  }, [s, vacancies])

  // Data-honesty (STATS-OOM-1): the published donut has no server-wide aggregate yet,
  // so it only ever reflects the loaded page — say so when there's more data than that.
  const publishedNotice = total > vacancies.length ? t('insights.publishedPageScopeNotice') : undefined

  return { statusData, ownerData, clientData, publishedData, phaseCounts, publishedNotice }
}
