/**
 * WorkflowQueueView — WF-WACHTRIJ-FE-1: the tenant-wide (or one-workflow) queue
 * snapshot (K-171, GET /workflows/queue). Four sections — pending / waiting
 * (resume_at) / scheduled (next_run_at + schedule_label) / retrying (attempts +
 * approximate next_attempt_at + last_error) — with the counts as small KPI
 * tiles up top. Workflow names deep-link into the editor (EntityLink); run rows
 * deep-link into the runs log, pre-filtered on that workflow (the existing
 * #details.runs?workflow_id= pattern, WEBHOOK-RUN-CORRELATION-1). Four UI states.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, PauseCircle, CalendarClock, RotateCcw, History } from 'lucide-react'
import { useWorkflowQueue } from './hooks/useWorkflowQueue'
import type { QueuePendingEntry, QueueWaitingEntry, QueueScheduledEntry, QueueRetryingEntry } from './hooks/useWorkflowQueue'
import EntityLink from '@/components/ui/EntityLink'
import KpiCard from '@/components/ui/KpiCard'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { SectionTitle, Caption } from '@/components/ui/typography'
import { canAccessPage } from '@/lib/access'
import { useAuth } from '@/context/AuthContext'
import { useDateFormat } from '@/lib/datetime'
import { useSeedLabel } from '@/lib/useSeedLabel'

// One "go to the runs log, filtered on this workflow" affordance — mirrors
// WorkflowRefs' own `#details.runs?workflow_id=` link, INCLUDING its gate: a
// role with AI agents but without Details would otherwise click into
// NoAccessPage (same Opus finding, same fix — §3 no fake affordances).
function OpenRunsButton({ workflowId, label }: { workflowId?: string | number; label: string }) {
  const auth = useAuth()
  if (workflowId == null) return null
  if (!canAccessPage('details.runs', auth ?? undefined)) return null
  return (
    <Button variant="ghost" iconOnly title={label} aria-label={label}
      href={`#details.runs?workflow_id=${encodeURIComponent(String(workflowId))}`}>
      <History size={12} />
    </Button>
  )
}

// One queue row's shell — workflow name (deep-links to the editor) + a caption
// line of section-specific detail + the "open runs" affordance on the right.
function QueueRow({ workflowId, workflowName, children, openRuns = true }: {
  workflowId?: string | number; workflowName?: string; children: ReactNode; openRuns?: boolean
}) {
  const { t } = useTranslation('workflows')
  const seedLabel = useSeedLabel()
  // LOOKUP-I18N-1: a queue row's workflow name is the same seeded default a
  // seeded workflow carries in the list/card views — translate it the same way.
  const displayName = workflowName ? seedLabel('workflowNames', { label: workflowName }) : undefined
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <EntityLink page="aiagents" id={workflowId}>{displayName ?? t('queue.unknownWorkflow')}</EntityLink>
        <div style={{ marginTop: 4 }}>{children}</div>
      </div>
      {openRuns && <OpenRunsButton workflowId={workflowId} label={t('queue.openRuns')} />}
    </div>
  )
}

// One section — icon + title + count, an honest empty line, or the rows.
function QueueSection<T>({ icon: Icon, title, rows, emptyLabel, renderRow }: {
  icon: typeof Clock; title: string; rows: T[]; emptyLabel: string
  renderRow: (row: T, i: number) => ReactNode
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Icon size={14} color="var(--text-muted)" />
        <SectionTitle as="span">{title}</SectionTitle>
        <Caption>({rows.length})</Caption>
      </div>
      {rows.length === 0
        ? <Caption>{emptyLabel}</Caption>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, i) => renderRow(row, i))}
          </div>}
    </div>
  )
}

// The tenant-wide (or one-workflow) queue snapshot: KPI counts up top, then the
// four independent pending/waiting/scheduled/retrying sections.
export default function WorkflowQueueView({ workflowId }: { workflowId?: string | number }) {
  const { t } = useTranslation('workflows')
  const { formatDateTime } = useDateFormat()
  const { pending, waiting, scheduled, retrying, counts, loading, error, forbidden, retry } = useWorkflowQueue(workflowId != null ? String(workflowId) : undefined)

  const isEmpty = !loading && !error && !forbidden
    && pending.length === 0 && waiting.length === 0 && scheduled.length === 0 && retrying.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Counts — small KPI tiles, always visible so the reader sees the totals
          even while a section itself is capped at 100 rows. */}
      {!loading && !error && !forbidden && (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <KpiCard label={t('queue.counts.pending')} value={counts.pending ?? 0} icon={Clock} />
          <KpiCard label={t('queue.counts.waiting')} value={counts.waiting ?? 0} icon={PauseCircle} />
          <KpiCard label={t('queue.counts.scheduledToday')} value={counts.scheduled_today ?? 0} icon={CalendarClock} />
          <KpiCard label={t('queue.counts.retrying')} value={counts.retrying ?? 0} icon={RotateCcw} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
          <Spinner size={15} /> {t('queue.loading')}
        </div>
      )}

      {/* Error (real failure — not the calm 403 degrade below) */}
      {!loading && error && (
        <ErrorBanner onRetry={retry}>{t('queue.loadFailed')}</ErrorBanner>
      )}

      {/* 403 (no settings.view): calm, honest, no fake affordance. */}
      {!loading && forbidden && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('queue.noAccess')}
        </div>
      )}

      {/* Honest rest state — every list genuinely empty. */}
      {isEmpty && (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {t('queue.empty')}
        </div>
      )}

      {/* The four sections — each renders independently (a workflow can have
          entries in one queue and none in the others). */}
      {!loading && !error && !forbidden && !isEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <QueueSection icon={Clock} title={t('queue.pending.title')} rows={pending} emptyLabel={t('queue.pending.empty')}
            renderRow={(row: QueuePendingEntry, i) => (
              <QueueRow key={row.run_id ?? i} workflowId={row.workflow_id} workflowName={row.workflow_name}>
                <Caption>
                  {t('queue.pending.queuedAt', { date: formatDateTime(row.queued_at) })}
                  {row.trigger ? ` · ${t(`queue.trigger.${row.trigger}`, { defaultValue: row.trigger })}` : ''}
                </Caption>
              </QueueRow>
            )} />

          <QueueSection icon={PauseCircle} title={t('queue.waiting.title')} rows={waiting} emptyLabel={t('queue.waiting.empty')}
            renderRow={(row: QueueWaitingEntry, i) => (
              <QueueRow key={row.run_id ?? i} workflowId={row.workflow_id} workflowName={row.workflow_name}>
                <Caption>{t('queue.waiting.resumeAt', { date: formatDateTime(row.resume_at) })}</Caption>
              </QueueRow>
            )} />

          <QueueSection icon={CalendarClock} title={t('queue.scheduled.title')} rows={scheduled} emptyLabel={t('queue.scheduled.empty')}
            renderRow={(row: QueueScheduledEntry, i) => (
              // Scheduled entries have no run yet — no "open runs" affordance.
              <QueueRow key={`${row.workflow_id ?? i}`} workflowId={row.workflow_id} workflowName={row.workflow_name} openRuns={false}>
                <Caption>
                  {t('queue.scheduled.nextRunAt', { date: formatDateTime(row.next_run_at) })}
                  {row.schedule_label ? ` · ${row.schedule_label}` : ''}
                </Caption>
              </QueueRow>
            )} />

          <QueueSection icon={RotateCcw} title={t('queue.retrying.title')} rows={retrying} emptyLabel={t('queue.retrying.empty')}
            renderRow={(row: QueueRetryingEntry, i) => (
              <QueueRow key={row.run_id ?? i} workflowId={row.workflow_id} workflowName={row.workflow_name}>
                <Caption as="div">
                  {t('queue.retrying.attempts', { count: row.attempts ?? 0 })}
                  {/* next_attempt_at is a derived estimate (K-171) — the "±" prefix
                      says so, never presented as an exact time. */}
                  {' · '}{t('queue.retrying.nextAttemptApprox', { date: formatDateTime(row.next_attempt_at) })}
                </Caption>
                {row.last_error && (
                  <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 2 }}>{row.last_error}</div>
                )}
              </QueueRow>
            )} />
        </div>
      )}
    </div>
  )
}
