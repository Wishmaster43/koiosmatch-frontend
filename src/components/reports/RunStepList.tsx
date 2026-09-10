/**
 * RunStepList — the per-step result viewer for a workflow run. Each step is a
 * card that expands to reveal its raw INPUT and OUTPUT data bundles (Make-style).
 * Shared by the global RunsTable drawer and the workflow editor's history drawer,
 * so step rendering lives in exactly one place (§3A, extend-don't-duplicate).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ChevronDown, Zap, Clock } from 'lucide-react'
import { formatDuration, StepStatusBadge } from './runFormat'
// House numeric shape (DATUM-1): digits only, so no locale is needed here.
import { hhmm } from '@/lib/localDate'
// HIST-DETAIL-1 (Danny 24-07 "je kan niet zien welke kandidaten"): the history
// drawer reuses the Logs panel's Make-style output table — one implementation.
import StepOutputSlice from '@/components/layout/workflow/StepOutputSlice'
import { useModuleCatalog } from '@/components/layout/workflow/useModuleCatalog'
import { Caption, BodyText } from '@/components/ui/typography'
import SoftChip from '@/components/ui/SoftChip'
import Button from '@/components/ui/Button'
import { useNavigation } from '@/context/NavigationContext'
import { pageForResultRef } from '@/components/layout/koios/koiosResultLinks'
import type { RunStep, RunStepMessage } from '@/types/reports'

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
        ? <Caption as="div" style={{ fontStyle: 'italic' }}>{t('runs.drawer.noData')}</Caption>
        // eslint-disable-next-line no-restricted-syntax -- DATA: intentional fixed dark terminal-style output block (matches the config-panel execution output styling per the file comment above), not a themeable UI colour
        : <pre style={{ fontSize: 11, lineHeight: 1.6, color: '#E2E8F0', background: '#1E293B', borderRadius: 8,
                        padding: 10, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {text}
          </pre>}
    </div>
  )
}

// A message status → its semantic colour (WA-SEND-STATUS-1: queued is honest, never "sent").
const MESSAGE_STATUS_COLOR: Record<string, string> = {
  sent: 'var(--color-success)', delivered: 'var(--color-success)', read: 'var(--color-success)',
  queued: 'var(--color-info)', scheduled: 'var(--color-info)',
  failed: 'var(--color-danger)', skipped: 'var(--color-warning)',
}

// The send step's counters as the engine reports them (whatsapp_sent / _queued / _skipped / _errors).
function sendCounters(output: unknown): { sent: number; queued: number; skipped: number; errors: number; noRecipients: boolean } | null {
  if (!output || typeof output !== 'object') return null
  const o = output as Record<string, unknown>
  if (!('whatsapp_sent' in o) && !('whatsapp_queued' in o)) return null
  const n = (v: unknown) => (Array.isArray(v) ? v.length : Number(v ?? 0)) || 0
  return { sent: n(o.whatsapp_sent), queued: n(o.whatsapp_queued), skipped: n(o.whatsapp_skipped), errors: n(o.whatsapp_errors), noRecipients: o.no_recipients === true }
}

// RUN-MESSAGES-1: the messages a send step produced — one row per recipient with the
// channel, an honest status chip (+ reason), the preview, and a deep link to the thread
// on the record it belongs to (the same navigation the Koios chips use).
function StepMessages({ messages, counters }: { messages: RunStepMessage[]; counters: ReturnType<typeof sendCounters> }) {
  const { t } = useTranslation('reports')
  const { openEntity } = useNavigation()
  const statusLabel = (s: string | null | undefined) => (s ? t(`runs.drawer.messages.status.${s}`, { defaultValue: s }) : '')
  return (
    <div style={{ padding: '0 12px 10px 33px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Caption as="div" style={{ fontWeight: 600 }}>
        {t('runs.drawer.messages.title')} ({messages.length})
        {counters && (counters.noRecipients || (messages.length === 0 && counters.sent + counters.queued === 0)) && (
          <> · {t('runs.drawer.messages.noRecipients')}</>
        )}
      </Caption>
      {messages.map((m, i) => {
        const page = m.subject ? pageForResultRef(m.subject.type) : null
        return (
          <div key={String(m.message_id ?? m.outbox_id ?? i)} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 12 }}>
            {page && m.subject
              ? <Button variant="ghostAccent" size="sm" style={{ padding: 0, height: 'auto' }} onClick={() => openEntity(page, String(m.subject!.id), 'communication')}>
                  {m.recipient_label}
                </Button>
              : <span style={{ fontWeight: 500 }}>{m.recipient_label}</span>}
            {m.channel && <Caption>{m.channel}</Caption>}
            {m.status && <SoftChip label={statusLabel(m.status)} color={MESSAGE_STATUS_COLOR[m.status] ?? 'var(--text-muted)'} title={m.reason ?? undefined} />}
            {m.preview && <Caption style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.preview}>{m.preview}</Caption>}
          </div>
        )
      })}
    </div>
  )
}

// One collapsible step card with its status, meta and expandable I/O bundles.
function StepCard({ step, index, catalog }: { step: RunStep; index: number; catalog: Parameters<typeof StepOutputSlice>[0]['catalog'] }) {
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
        <BodyText as="span" style={{ fontWeight: 500, flex: 1, minWidth: 0,
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </BodyText>
        {/* Per-step meta: operations + duration */}
        {step.operations != null && (
          <Caption style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Zap size={10} />{step.operations}
          </Caption>
        )}
        {step.duration_ms != null && (
          <Caption style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} />{formatDuration(step.duration_ms)}
          </Caption>
        )}
        <StepStatusBadge status={step.status} ok={step.ok} />
      </div>

      {/* Message (always visible when present) */}
      {step.message && (
        <Caption as="div" style={{ padding: '0 12px 10px 33px' }}>{step.message}</Caption>
      )}

      {/* HIST-DETAIL-1: the one-line outcome (e.g. "466 synced") always visible. */}
      {step.summary != null && step.summary !== '' && (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-success-text)', padding: '0 12px 10px 33px' }}>{String(step.summary)}</div>
      )}

      {/* WF-R3 live meta: retry count, error and when the next attempt fires. */}
      {(Number(step.attempts ?? 0) > 1 || step.error || step.error_message || step.next_attempt_at) && (
        <div style={{ fontSize: 11, padding: '0 12px 10px 33px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Number(step.attempts ?? 0) > 1 && (
            <span style={{ color: 'var(--text-muted)' }}>{t('runs.drawer.attempts', { count: Number(step.attempts) })}</span>
          )}
          {(step.error ?? step.error_message) != null && (
            <span style={{ color: 'var(--color-danger-text)' }}>{String(step.error ?? step.error_message)}</span>
          )}
          {step.next_attempt_at != null && (
            <span style={{ color: 'var(--text-muted)' }}>{t('runs.drawer.nextAttempt', { time: hhmm(new Date(String(step.next_attempt_at))) })}</span>
          )}
        </div>
      )}

      {/* RUN-MESSAGES-1: the messages of a send step (always visible when the run carries them),
          with the engine's honest counters — zero recipients says so. */}
      {(Array.isArray(step.messages) || sendCounters(step.output)) && (
        <StepMessages messages={Array.isArray(step.messages) ? step.messages : []} counters={sendCounters(step.output)} />
      )}
      {/* Expanded detail: FIRST the readable Make-style output table (which
          candidates, per column — HIST-DETAIL-1), then the raw I/O bundles. */}
      {open && hasIO && (
        <div style={{ padding: '0 12px 12px 33px' }}>
          <StepOutputSlice step={step} catalog={catalog} />
          <BundleBlock label={t('runs.drawer.input')}  value={step.input} />
          <BundleBlock label={t('runs.drawer.output')} value={step.output} />
        </div>
      )}
    </div>
  )
}

export default function RunStepList({ steps }: { steps: RunStep[] }) {
  // Bundle-shape catalog (output_fields per module type) for the per-step slices —
  // session-cached, same source as the Logs panel (HIST-DETAIL-1).
  const { catalog } = useModuleCatalog()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step, i) => <StepCard key={i} step={step} index={i} catalog={catalog} />)}
    </div>
  )
}
