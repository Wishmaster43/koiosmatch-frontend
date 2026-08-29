/**
 * KoiosLearningCard — C1-lane 2 (K-148): the tenant-facing Koios learning report.
 * Deterministic report (no AI call, API-CREDITS-1) over the last 30 days:
 * top questions, failure reasons, a denied-tools honesty flag, feedback and
 * suggestions. No period picker in v1 (default window only).
 */
import { useEffect, useState } from 'react'
import { bureauNow } from '@/lib/bureauTime'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import StatTile from '@/components/ui/StatTile'
import { SectionTitle, Caption, Mono } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'
import { getKoiosLearning } from './koiosApi'
import { toLocalIsoDate } from '@/lib/datetime'

const card = { border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14, background: 'var(--surface)' }
const notice = { fontSize: 12, color: 'var(--text-muted)' }

// Last 30 days, YYYY-MM-DD via the house toLocalIsoDate — built from LOCAL date
// parts, so the window never shifts an hour after midnight (UTC slice did).
function last30Days(now: Date = bureauNow()): { from: string; to: string } {
  const from = new Date(now)
  from.setDate(from.getDate() - 30)
  return { from: toLocalIsoDate(from), to: toLocalIsoDate(now) }
}

interface TopQuestion { question: string; count: number }
interface FailureReasons { refusal: number; budget: number; tool_error: number; no_result: number }
interface Feedback { down_pct: number | null; top_reasons: string[]; examples: string[] }
interface LearningData {
  period?: { from: string; to: string }
  top_questions: TopQuestion[]
  failure_reasons: FailureReasons
  tools_requested_but_denied: { not_tracked: true }
  feedback: Feedback
  suggestions: string[]
}

type Phase = 'loading' | 'error' | 'ready'

// The Koios learning report card: fetches once for the default 30-day window and renders four calm sub-blocks.
export default function KoiosLearningCard() {
  const { t } = useTranslation('koios')
  const { formatNumber } = useNumberFormat()
  const [data, setData] = useState<LearningData | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')

  // Load the report; abort-safe so a slow response never overwrites a later one (§9).
  const load = () => {
    let alive = true
    setPhase('loading')
    const { from, to } = last30Days()
    getKoiosLearning(from, to)
      .then((d: unknown) => { if (alive) { setData(d as LearningData); setPhase('ready') } })
      .catch(() => { if (alive) setPhase('error') })
    return () => { alive = false }
  }
  useEffect(() => load(), [])

  if (phase === 'loading') {
    return <div style={card} role="status"><div style={{ display: 'flex', alignItems: 'center', gap: 8, ...notice }}><Spinner size={14} /> {t('learning.loading')}</div></div>
  }

  if (phase === 'error') {
    return (
      <div style={card} role="alert">
        <p style={{ ...notice, marginBottom: 8 }}>{t('learning.loadError')}</p>
        <Button variant="secondary" size="sm" onClick={load}>{t('learning.retry')}</Button>
      </div>
    )
  }

  const topQuestions = data?.top_questions ?? []
  const failure = data?.failure_reasons
  const feedback = data?.feedback
  const suggestions = data?.suggestions ?? []
  const notTracked = data?.tools_requested_but_denied?.not_tracked === true

  return (
    <>
      {/* Top questions — plain ranked list, counts in Mono. */}
      <div style={card}>
        <SectionTitle>{t('learning.topQuestions')}</SectionTitle>
        {topQuestions.length === 0
          ? <p style={{ ...notice, marginTop: 8 }}>{t('learning.noQuestions')}</p>
          : (
            <ul style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0 }}>
              {topQuestions.map((q, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span>{q.question}</span>
                  <Mono style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{q.count}</Mono>
                </li>
              ))}
            </ul>
          )}
      </div>

      {/* Failure reasons — four labelled counts via the shared StatTile. */}
      <div style={card}>
        <SectionTitle>{t('learning.failureReasons')}</SectionTitle>
        {!failure
          ? <p style={{ ...notice, marginTop: 8 }}>{t('learning.noFailures')}</p>
          : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <StatTile size="sm" label={t('learning.failureRefusal')} value={failure.refusal ?? 0} style={{ flex: '1 1 120px' }} />
              <StatTile size="sm" label={t('learning.failureBudget')} value={failure.budget ?? 0} style={{ flex: '1 1 120px' }} />
              <StatTile size="sm" label={t('learning.failureToolError')} value={failure.tool_error ?? 0} style={{ flex: '1 1 120px' }} />
              <StatTile size="sm" label={t('learning.failureNoResult')} value={failure.no_result ?? 0} style={{ flex: '1 1 120px' }} />
            </div>
          )}
        {/* Honest flag: never render this as a zero — the backend does not track it yet. */}
        {notTracked && <p style={{ ...notice, marginTop: 10 }}>{t('learning.deniedNotTracked')}</p>}
      </div>

      {/* Feedback — down_pct is a value from the server, rendered as a percentage as-is. */}
      <div style={card}>
        <SectionTitle>{t('learning.feedback')}</SectionTitle>
        {!feedback || (!feedback.top_reasons?.length && !feedback.examples?.length && !feedback.down_pct)
          ? <p style={{ ...notice, marginTop: 8 }}>{t('learning.noFeedback')}</p>
          : (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13 }}>
                {t('learning.downPct', { pct: feedback.down_pct == null ? '—' : `${formatNumber(feedback.down_pct)}%` })}
              </div>
              {feedback.top_reasons?.length > 0 && (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 4, listStyle: 'none', padding: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  {feedback.top_reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
              {feedback.examples?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {feedback.examples.map((ex, i) => <Caption key={i}>&ldquo;{ex}&rdquo;</Caption>)}
                </div>
              )}
            </div>
          )}
      </div>

      {/* Suggestions — bullet list. */}
      <div style={card}>
        <SectionTitle>{t('learning.suggestions')}</SectionTitle>
        {suggestions.length === 0
          ? <p style={{ ...notice, marginTop: 8 }}>{t('learning.noSuggestions')}</p>
          : (
            <ul style={{ marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              {suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
      </div>
    </>
  )
}
