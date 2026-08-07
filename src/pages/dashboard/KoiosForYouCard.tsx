/**
 * KoiosForYouCard — "Koios deed dit voor jou" (K0-D noordster report): the
 * tenant's Koios-TRIGGERED workflow runs over the last 7/30 days. GET
 * /ai/koios/for-you?days=7|30 → { period, actions_total, per_type, per_source,
 * latest[<=10] } — same telbron as the invoice's workflow-token ledger, so this
 * card and the billing screen always agree. A manual/event run never counts.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import SoftChip from '@/components/ui/SoftChip'
import SegmentedControl from '@/components/ui/SegmentedControl'
import ErrorBanner from '@/components/ui/ErrorBanner'

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

export default function KoiosForYouCard() {
  const { t } = useTranslation(['dashboard', 'common'])
  const { formatDate } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  // 7 vs 30 days — local UI state; the query key includes it so the toggle
  // refetches (and caches) each period independently.
  const [days, setDays] = useState<PeriodDays>(7)

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

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      {/* Header — Koios mark carries the AI-Act disclosure hint as a tooltip
          (mirrors KoiosAdviceBlock: the title already names Koios explicitly, so
          this isn't a bare icon), title, and the 7/30-day period toggle. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <KoiosAiMark size={18} title={t('common:aiGeneratedHint')} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{t('koiosForYou.title')}</span>
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
          <Loader2 size={16} className="animate-spin" />
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

      {/* Success — hero total, per-type breakdown, latest runs. */}
      {!isLoading && !isError && data && data.actions_total > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{formatNumber(data.actions_total)}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('koiosForYou.heroLabel')}</span>
          </div>

          {/* Per-type breakdown — one soft chip per template_key, most-used first. */}
          {Object.keys(data.per_type).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                {t('koiosForYou.breakdownTitle')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(data.per_type)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, count]) => (
                    <SoftChip key={key} color="var(--color-primary)" label={`${humanizeKey(key)} · ${formatNumber(count)}`} />
                  ))}
              </div>
            </div>
          )}

          {/* Latest runs — up to 10, what (template) + when (formatted date/time). */}
          {data.latest.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                {t('koiosForYou.latestTitle')}
              </div>
              {data.latest.map((run, i) => {
                const ok = run.status === 'completed'
                const failed = run.status === 'failed'
                const Icon = ok ? CheckCircle : failed ? AlertCircle : Clock
                const color = ok ? 'var(--color-success)' : failed ? 'var(--color-danger)' : 'var(--text-muted)'
                return (
                  <div key={run.run_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                    borderBottom: i < data.latest.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <Icon size={14} color={color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {humanizeKey(run.template_key)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sourceLabel(run.source.split(':')[0])}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatDate(run.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
