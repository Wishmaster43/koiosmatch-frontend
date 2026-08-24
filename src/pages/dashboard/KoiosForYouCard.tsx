/**
 * KoiosForYouCard — "Koios deed dit voor jou" (K0-D noordster report): the
 * tenant's Koios-TRIGGERED workflow runs over the last 7/30 days. GET
 * /ai/koios/for-you?days=7|30 → { period, actions_total, per_type, per_source,
 * latest[<=10] } — same telbron as the invoice's workflow-token ledger, so this
 * card and the billing screen always agree. A manual/event run never counts.
 *
 * KOIOS-KAART-COMPACT-1 (Danny 24-08): the card defaults to COMPACT — hero
 * total + a category KPI row (≤9 chips) — and only expands into the raw
 * per-run list on demand, with translated (never raw-English) action labels.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, AlertCircle, Clock, ChevronDown } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Spinner from '@/components/ui/Spinner'
import SoftChip from '@/components/ui/SoftChip'
import SegmentedControl from '@/components/ui/SegmentedControl'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Button from '@/components/ui/Button'
import { GroupLabel, SectionTitle, Caption } from '@/components/ui/typography'

type PeriodDays = 7 | 30

// One Koios-triggered workflow run, as returned in the `latest` array.
interface KoiosForYouRun {
  run_id: string | number
  template_key: string | null
  source: string
  created_at: string | null
  status: string
}

// The full report shape — hand-written (§10: no api-generated.ts entry for this
// route yet; type what the spec gives, hand-write the rest).
interface KoiosForYouReport {
  period: string
  actions_total: number
  per_type: Record<string, number>
  per_source: Record<string, number>
  latest: KoiosForYouRun[]
}

// Backend "source" buckets are a small, code-driven set (note/conversation/chat,
// see BillingReport::forYou) — translated when known; anything else (a future
// K-phase source) falls back to a humanized version of the raw bucket, never a
// raw i18n key.
const KNOWN_SOURCES = ['note', 'conversation', 'chat']

// Turn a workflow template_key ("koios_create_task") into a readable label —
// these are backend workflow identifiers, not app copy, so a display transform
// (not a translation) is the right treatment, mirroring how slugs read elsewhere.
function humanizeKey(key: string | null | undefined): string {
  if (!key) return '—'
  return key.replace(/^koios_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// KOIOS-KAART-COMPACT-1: bucket every action type into one of eight display
// categories. Measured real template_key values (BE Workflow model / seeded
// native templates, koiosmatch-api database/): koios_create_task,
// koios_send_whatsapp, koios_plan_appointment, koios_send_email,
// koios_send_notification, koios_add_to_calllist. Rejection/application/
// birthday automations don't have template keys yet but keep their own bucket
// so a future one lands correctly without a code change; anything matching no
// keyword (today: send_notification, add_to_calllist) falls into 'other' —
// an unknown type is NEVER dropped.
const CATEGORY_ORDER = ['tasks', 'whatsapp', 'appointments', 'emails', 'rejections', 'applications', 'birthdays', 'other'] as const
type Category = (typeof CATEGORY_ORDER)[number]

// Raw action-type keys (koios_ prefix stripped) that have a translated label —
// anything outside this set gets the humanized fallback, never a raw i18n key
// (mirrors the KNOWN_SOURCES/sourceLabel split above).
const KNOWN_ACTION_TYPES = ['create_task', 'send_whatsapp', 'plan_appointment', 'send_email', 'send_notification', 'add_to_calllist']

// Keyword match on the normalized (prefix-stripped) key → category bucket.
function categoryOf(rawKey: string | null | undefined): Category {
  const k = (rawKey || '').replace(/^koios_/, '')
  if (/task/.test(k)) return 'tasks'
  if (/whatsapp/.test(k)) return 'whatsapp'
  if (/appointment/.test(k)) return 'appointments'
  if (/email/.test(k)) return 'emails'
  if (/reject/.test(k)) return 'rejections'
  if (/application|apply/.test(k)) return 'applications'
  if (/birthday/.test(k)) return 'birthdays'
  return 'other'
}

export default function KoiosForYouCard() {
  const { t } = useTranslation(['dashboard', 'common'])
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  // 7 vs 30 days — local UI state; the query key includes it so the toggle
  // refetches (and caches) each period independently.
  const [days, setDays] = useState<PeriodDays>(7)
  // Compact by default (no localStorage — a per-session UI choice, not a
  // persisted preference); the arrow affordance below toggles the raw list.
  const [expanded, setExpanded] = useState(false)

  // Koios-triggered workflow runs only (never a manual/event run) — the query
  // itself IS the data-fetching hook (§3), no separate wrapper needed for one call.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['koios', 'for-you', days],
    queryFn: async ({ signal }) =>
      unwrap<KoiosForYouReport>(await api.get('/ai/koios/for-you', { params: { days }, signal })),
  })

  // Known source bucket → translated label; unknown buckets get a humanized
  // fallback instead of a raw i18n key.
  const sourceLabel = (bucket: string) =>
    KNOWN_SOURCES.includes(bucket) ? t(`koiosForYou.source.${bucket}`) : humanizeKey(bucket)

  // Known action type → translated label; unknown types (a future automation)
  // get the humanized fallback, so the DOM never shows a raw English key.
  const actionLabel = (rawKey: string | null | undefined) => {
    const norm = (rawKey || '').replace(/^koios_/, '')
    return KNOWN_ACTION_TYPES.includes(norm) ? t(`koiosForYou.actionType.${norm}`) : humanizeKey(rawKey)
  }

  // Category → total count, from per_type — drives the compact KPI row.
  const categoryCounts: Record<Category, number> = data
    ? CATEGORY_ORDER.reduce((acc, c) => {
        acc[c] = 0
        return acc
      }, {} as Record<Category, number>)
    : ({} as Record<Category, number>)
  if (data) {
    Object.entries(data.per_type).forEach(([key, count]) => {
      categoryCounts[categoryOf(key)] += count
    })
  }
  const activeCategories = data
    ? CATEGORY_ORDER.filter((c) => categoryCounts[c] > 0).sort((a, b) => categoryCounts[b] - categoryCounts[a])
    : []

  // Latest runs grouped per category — only used in the expanded view.
  const groupedLatest = data
    ? CATEGORY_ORDER.map((cat) => ({ cat, runs: data.latest.filter((r) => categoryOf(r.template_key) === cat) })).filter(
        (g) => g.runs.length > 0,
      )
    : []

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      {/* Header — Koios mark carries the AI-Act disclosure hint as a tooltip
          (mirrors KoiosAdviceBlock: the title already names Koios explicitly, so
          this isn't a bare icon), title, and the 7/30-day period toggle. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <KoiosAiMark size={18} title={t('common:aiGeneratedHint')} />
        <SectionTitle style={{ flex: 1 }}>{t('koiosForYou.title')}</SectionTitle>
        <SegmentedControl
          size="compact"
          ariaLabel={t('koiosForYou.periodLabel')}
          value={String(days)}
          onChange={(v) => setDays(Number(v) as PeriodDays)}
          options={[
            { value: '7', label: t('koiosForYou.period.7') },
            { value: '30', label: t('koiosForYou.period.30') },
          ]}
        />
      </div>

      {/* Loading — the report for the active period is in flight. */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
          <Spinner size={16} />
          <span style={{ fontSize: 12 }}>{t('common:loading')}</span>
        </div>
      )}

      {/* Error — the report call failed (e.g. missing koios.use permission, or a
          transient network error); a calm banner with retry, never a blank card. */}
      {!isLoading && isError && (
        <ErrorBanner onRetry={() => refetch()}>{t('koiosForYou.loadError')}</ErrorBanner>
      )}

      {/* Empty — no Koios-triggered runs in the selected period. */}
      {!isLoading && !isError && data && data.actions_total === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t('koiosForYou.empty')}</div>
          <div style={{ fontSize: 12 }}>{t('koiosForYou.emptySub')}</div>
        </div>
      )}

      {/* Success — hero total, compact category breakdown, expandable per-run list. */}
      {!isLoading && !isError && data && data.actions_total > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{formatNumber(data.actions_total)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('koiosForYou.heroLabel')}</span>
          </div>

          {/* Category KPI row — compact by default: category label + count only,
              never the raw per-run list. The arrow expands into the grouped list. */}
          {activeCategories.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <GroupLabel>{t('koiosForYou.breakdownTitle')}</GroupLabel>
                <Button
                  iconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={t(expanded ? 'koiosForYou.collapse' : 'koiosForYou.expand')}
                  aria-expanded={expanded}
                  onClick={() => setExpanded((e) => !e)}
                  style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
                >
                  <ChevronDown size={14} />
                </Button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeCategories.map((c) => (
                  <SoftChip key={c} color="var(--color-primary)" label={`${t(`koiosForYou.category.${c}`)} · ${formatNumber(categoryCounts[c])}`} />
                ))}
              </div>
            </div>
          )}

          {/* Expanded — the raw per-run list, subdivided per category with a
              GroupLabel category heading, translated action labels per row. */}
          {expanded && groupedLatest.length > 0 && (
            <div>
              <GroupLabel style={{ marginBottom: 6 }}>{t('koiosForYou.latestTitle')}</GroupLabel>
              {groupedLatest.map(({ cat, runs }) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <GroupLabel style={{ marginBottom: 4 }}>{t(`koiosForYou.category.${cat}`)}</GroupLabel>
                  {runs.map((run, i) => {
                    const ok = run.status === 'completed'
                    const failed = run.status === 'failed'
                    const Icon = ok ? CheckCircle : failed ? AlertCircle : Clock
                    const color = ok ? 'var(--color-success)' : failed ? 'var(--color-danger)' : 'var(--text-muted)'
                    return (
                      <div key={run.run_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                        borderBottom: i < runs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <Icon size={14} color={color} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {actionLabel(run.template_key)}
                          </div>
                          <Caption>{sourceLabel(run.source.split(':')[0])}</Caption>
                        </div>
                        <Caption style={{ flexShrink: 0 }}>
                          {formatDate(run.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Caption>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
