/**
 * KoiosFeedbackCard — KOIOS-FEEDBACK-FE-1 (23-08): the admin overview of
 * thumbs up/down feedback left on Koios answers. Read-only, no AI call
 * (API-CREDITS-1) — the endpoint is pure reporting over already-stored rows.
 * Measured against KoiosFeedbackController::index(): {summary{total,up,down,
 * down_pct,reasons{}}, data[{id,surface,rating,reasons[],comment,user,
 * prompt_excerpt,created_at}], total, per_page, current_page, last_page}.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import SoftChip from '@/components/ui/SoftChip'
import StatTile from '@/components/ui/StatTile'
import PaginationBar from '@/components/ui/PaginationBar'
import { SectionTitle, Caption, BodyText } from '@/components/ui/typography'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import { getKoiosFeedback } from './koiosApi'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const REASON_KEYS = ['inaccurate', 'incomplete', 'harmful', 'tone', 'other']

// One feedback row's shape (§10: this success shape is hand-typed — the
// generated spec only documents the 401 error response for this endpoint).
interface FeedbackRow {
  id: string
  surface: string
  rating: 'up' | 'down'
  reasons: string[]
  comment: string | null
  user: { id: string; name: string } | null
  prompt_excerpt: string | null
  created_at: string
}
interface FeedbackSummary { total: number; up: number; down: number; down_pct: number; reasons: Record<string, number> }
interface FeedbackData {
  summary: FeedbackSummary
  data: FeedbackRow[]
  total: number
  per_page: number
  current_page: number
  last_page: number
}

type Phase = 'loading' | 'error' | 'ready'

// The admin feedback card: summary block + a paginated read-only row list.
export default function KoiosFeedbackCard() {
  const { t } = useTranslation('koios')
  const { t: tc } = useTranslation('common')
  const { formatDateTime } = useDateFormat()
  const { formatNumber } = useNumberFormat()
  const [data, setData] = useState<FeedbackData | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  
  // Load the current page; abort-safe so a stale page-switch response never
  // wins (§9). Retry bumps the tick to re-run the same effect.
  const [retryTick, setRetryTick] = useState(0)
  useEffect(() => {
    let alive = true
    setPhase('loading')
    getKoiosFeedback(page, perPage)
      .then((d: unknown) => { if (alive) { setData(d as FeedbackData); setPhase('ready') } })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }, [page, perPage, retryTick])

  if (phase === 'loading') {
    return <div style={card} role="status"><Caption as="div" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Spinner size={14} /> {t('feedbackAdmin.loading')}</Caption></div>
  }

  if (phase === 'error') {
    return (
      <div style={card} role="alert">
        <Caption as="p" style={{ marginBottom: 8 }}>{t('feedbackAdmin.loadError')}</Caption>
        <Button variant="secondary" size="sm" onClick={() => setRetryTick((n) => n + 1)}>{t('feedbackAdmin.retry')}</Button>
      </div>
    )
  }

  const summary = data?.summary
  const rows = data?.data ?? []
  // Reasons that actually occurred, sorted by count — an unused reason renders no chip.
  const topReasons = summary
    ? REASON_KEYS.map((k) => ({ key: k, count: summary.reasons?.[k] ?? 0 })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count)
    : []

  return (
    <>
      {/* Summary block: totals + down-percentage + top reasons as soft chips. */}
      <div style={card}>
        <SectionTitle>{t('feedbackAdmin.summaryTitle')}</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <StatTile size="sm" label={t('feedbackAdmin.total')} value={formatNumber(summary?.total ?? 0)} style={{ flex: '1 1 100px' }} />
          <StatTile size="sm" label={tc('koios.feedback.up')} value={formatNumber(summary?.up ?? 0)} style={{ flex: '1 1 100px' }} />
          <StatTile size="sm" label={tc('koios.feedback.down')} value={formatNumber(summary?.down ?? 0)} style={{ flex: '1 1 100px' }} />
          <StatTile size="sm" label={t('feedbackAdmin.downPct')} value={`${formatNumber(summary?.down_pct ?? 0)}%`} style={{ flex: '1 1 100px' }} />
        </div>
        {topReasons.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {topReasons.map((r) => (
              <SoftChip key={r.key} color="var(--color-warning)" label={`${tc(`koios.feedback.reasons.${r.key}`)} · ${formatNumber(r.count)}`} />
            ))}
          </div>
        )}
      </div>

      {/* List: one row per feedback entry — NOTITIE-REFERENTIE idiom (chip · author · date · comment). */}
      <div style={card}>
        <SectionTitle>{t('feedbackAdmin.listTitle')}</SectionTitle>
        {rows.length === 0
          ? <Caption as="p" style={{ marginTop: 8 }}>{t('feedbackAdmin.empty')}</Caption>
          : (
            <ul style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', padding: 0 }}>
              {rows.map((row) => (
                <li key={row.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <SoftChip color="var(--color-primary)" label={t(`feedbackAdmin.surfaces.${row.surface}`, { defaultValue: row.surface })} />
                    <span role="img" aria-label={row.rating === 'up' ? tc('koios.feedback.up') : tc('koios.feedback.down')} title={row.rating === 'up' ? tc('koios.feedback.up') : tc('koios.feedback.down')}>
                      {row.rating === 'up' ? <ThumbsUp size={14} color="var(--color-success)" /> : <ThumbsDown size={14} color="var(--color-danger)" />}
                    </span>
                    {row.reasons.length > 0 && (
                      <Caption>
                        {row.reasons.map((r) => tc(`koios.feedback.reasons.${r}`)).join(', ')}
                      </Caption>
                    )}
                    <Caption style={{ marginLeft: 'auto' }}>{row.user?.name ?? '—'} · {formatDateTime(row.created_at)}</Caption>
                  </div>
                  {row.prompt_excerpt && <Caption>{row.prompt_excerpt}</Caption>}
                  <BodyText as="p">{row.comment || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('feedbackAdmin.noComment')}</span>}</BodyText>
                </li>
              ))}
            </ul>
          )}
        {data && data.last_page > 1 && (
          <div style={{ marginTop: 12 }}>
            <PaginationBar
              page={data.current_page}
              totalPages={data.last_page}
              totalRows={data.total}
              pageSize={perPage}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPerPage(n); setPage(1) }}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        )}
      </div>
    </>
  )
}
