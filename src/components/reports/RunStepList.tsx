/**
 * RunStepList — the per-step result viewer for a workflow run. Each step is a
 * card that expands to reveal its raw INPUT and OUTPUT data bundles (Make-style).
 * Shared by the global RunsTable drawer and the workflow editor's history drawer,
 * so step rendering lives in exactly one place (§3A, extend-don't-duplicate).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, Zap, Clock } from 'lucide-react'
import { formatDuration, StatusBadge } from './runFormat'
import type { RunStep } from '@/types/reports'

// Pretty-print a data bundle as JSON, or null when there is nothing to show.
function stringifyBundle(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

// Dark, monospaced block for one INPUT/OUTPUT bundle — matches the config-panel
// execution output styling so run data reads consistently across the app.
function BundleBlock({ label, value }: { label: string; value: unknown }) {
  const { t } = useTranslation('reports')
  const text = stringifyBundle(value)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      {text == null
        ? <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('runs.drawer.noData')}</div>
        // eslint-disable-next-line no-restricted-syntax -- DATA: intentional fixed dark terminal-style output block (matches the config-panel execution output styling per the file comment above), not a themeable UI colour
        : <pre style={{ fontSize: 11, lineHeight: 1.6, color: '#E2E8F0', background: '#1E293B', borderRadius: 8,
                        padding: 10, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {text}
          </pre>}
    </div>
  )
}

// One collapsible step card with its status, meta and expandable I/O bundles.
function StepCard({ step, index }: { step: RunStep; index: number }) {
  const { t } = useTranslation('reports')
  const [open, setOpen] = useState(false)
  const hasIO = step.input != null || step.output != null
  const title = step.label ?? step.type ?? t('runs.drawer.step', { n: index + 1 })

  return (
    <div style={{ background: 'var(--hover-bg)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header — toggles the I/O detail; not a button when there is nothing to expand */}
      <div
        role={hasIO ? 'button' : undefined}
        tabIndex={hasIO ? 0 : undefined}
        aria-expanded={hasIO ? open : undefined}
        onClick={() => hasIO && setOpen(o => !o)}
        onKeyDown={e => { if (hasIO && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(o => !o) } }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                 cursor: hasIO ? 'pointer' : 'default' }}>
        {hasIO
          ? (open ? <ChevronDown size={13} color="var(--text-muted)" /> : <ChevronRight size={13} color="var(--text-muted)" />)
          : <span style={{ width: 13, flexShrink: 0 }} />}
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0,
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {/* Per-step meta: operations + duration */}
        {step.operations != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
            <Zap size={10} />{step.operations}
          </span>
        )}
        {step.duration_ms != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)' }}>
            <Clock size={10} />{formatDuration(step.duration_ms)}
          </span>
        )}
        <StatusBadge status={step.status ?? (step.ok ? 'success' : 'failed')} />
      </div>

      {/* Message (always visible when present) */}
      {step.message && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 12px 10px 33px' }}>{step.message}</div>
      )}

      {/* WF-R3 live meta: retry count, error and when the next attempt fires. */}
      {(Number(step.attempts ?? 0) > 1 || step.error || step.error_message || step.next_attempt_at) && (
        <div style={{ fontSize: 11, padding: '0 12px 10px 33px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Number(step.attempts ?? 0) > 1 && (
            <span style={{ color: 'var(--text-muted)' }}>{t('runs.drawer.attempts', { count: Number(step.attempts) })}</span>
          )}
          {(step.error ?? step.error_message) != null && (
            <span style={{ color: 'var(--color-danger)' }}>{String(step.error ?? step.error_message)}</span>
          )}
          {step.next_attempt_at != null && (
            <span style={{ color: 'var(--text-muted)' }}>{t('runs.drawer.nextAttempt', { time: new Date(String(step.next_attempt_at)).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) })}</span>
          )}
        </div>
      )}

      {/* Expanded I/O bundles */}
      {open && hasIO && (
        <div style={{ padding: '0 12px 12px 33px' }}>
          <BundleBlock label={t('runs.drawer.input')}  value={step.input} />
          <BundleBlock label={t('runs.drawer.output')} value={step.output} />
        </div>
      )}
    </div>
  )
}

export default function RunStepList({ steps }: { steps: RunStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step, i) => <StepCard key={i} step={step} index={i} />)}
    </div>
  )
}
