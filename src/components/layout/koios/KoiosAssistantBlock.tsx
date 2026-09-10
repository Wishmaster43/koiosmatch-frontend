/**
 * KoiosAssistantBlock — the assistant's opening move on the Koios panel
 * (KOIOS-ASSISTANT-FE-1, §0B: "an assistant finishes the loop"). Renders
 * GET /ai/koios/assistant's suggestions IN SERVER ORDER (already urgency-sorted,
 * never re-sorted here). Collapsible via the shared CollapsedCard, its own
 * persisted storage key (mirrors useKoiosRadarCollapse's convention).
 *
 * Danny 09-09 (live review, evening): ONE compact row per suggestion — the deep-link
 * chip IS the title, the reason sits beside it, the actions on the same line; every
 * row wears the same two actions (Uitvoeren + a chat icon), never a filled button on
 * one row and a link on the next; a confirmed action shows the record it created as
 * a chip (§0B), and the chat handoff carries the record ref + the reason, so Koios
 * knows who and why ("Koios snapt er niets van").
 */
import { useTranslation } from 'react-i18next'
import { Clock, UserX, Target, Briefcase, Sparkles, MessageSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import KoiosCardFrame from './KoiosCardFrame'
import { Caption } from '@/components/ui/typography'
import ErrorBanner from '@/components/ui/ErrorBanner'
import { KoiosRefChip } from './KoiosResultCards'
import { useKoiosAssistant } from './useKoiosAssistant'
import { useKoiosRadarCollapse } from './useKoiosRadarCollapse'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { confirmPendingAction, cancelPendingAction, stagePendingAction } from './koiosApi'
import { createdRefFromToolResult } from './koiosToolResult'
import { extractApiError } from '@/lib/extractApiError'
import type { KoiosAssistantKind, KoiosAssistantSuggestion } from './useKoiosAssistant'
import type { KoiosPreviewRow } from './koiosTypes'
import type { KoiosContextRef } from '@/types/koios'
import type { ActionBudget } from '@/types/actionBudget'

// The chat handoff: the prefill text plus the records it concerns (context chips).
export type AskKoios = (text: string, refs: KoiosContextRef[]) => void

// Icon + semantic-token colour per suggestion kind (§4: colour carries meaning, never decoration).
const KIND_META: Record<KoiosAssistantKind, { Icon: LucideIcon; color: string }> = {
  pending_action:            { Icon: Sparkles,  color: 'var(--color-primary)' },
  task_overdue:              { Icon: Clock,      color: 'var(--color-warning-text)' },
  candidate_no_contact:      { Icon: UserX,      color: 'var(--color-warning-text)' },
  opportunity_closing_soon:  { Icon: Target,     color: 'var(--color-info)' },
  vacancy_zero_applications: { Icon: Briefcase,  color: 'var(--text-muted)' },
}

// The refs the chat can use as context: real records, never the parked-action handle.
const contextRefsOf = (s: KoiosAssistantSuggestion) => s.refs.filter(r => r.type !== 'pending_action')

// A preview row's user-facing line; raw id rows (kandidaat_id: <uuid>) are the chip's
// job and never read as text.
const previewLine = (row: KoiosPreviewRow) => row.before != null || row.after != null
  ? `${row.label} · ${row.before ?? '—'} → ${row.after ?? '—'}`
  : `${row.label}${row.text ? `: ${row.text}` : ''}`
const isIdRow = (row: KoiosPreviewRow) => /_id$/i.test(row.label)

// Stable row identity (Opus golf-2 verify): the pending-action id when present,
// else kind+title — NEVER the array index, which glued one action's terminal
// state onto a DIFFERENT action after a refetch reshuffled the list.
function suggestionKey(s: KoiosAssistantSuggestion): string {
  const ref = s.refs.find(r => r.type === 'pending_action')
  return ref ? `pa:${ref.id}` : `${s.kind}:${s.title}`
}

// Per-suggestion execute state. Descriptor kinds add the staged leg (golf 3):
// idle → staging → staged(preview) → submitting → executed/cancelled/error.
type StagedAction = { id: string; title?: string; preview?: KoiosPreviewRow[]; expires_at?: string }
type ExecState = {
  phase: 'idle' | 'staging' | 'staged' | 'submitting' | 'executed' | 'cancelled' | 'error'
  message?: string
  staged?: StagedAction
  // The record the confirmed tool created (§0B: a link to what it did), when it made one.
  created?: KoiosContextRef | null
  // KOIOS-CONFIRM-DECLINE-1 (PRIJSMODEL-C): the staffel stand on a budget-full decline.
  budget?: ActionBudget
}

// One error row: the server's message, plus a budget_exceeded upgrade hint when
// present (KOIOS-CONFIRM-DECLINE-1) — never a price, only the upgrade label.
function ExecErrorNotice({ message, budget, t }: { message?: string; budget?: ActionBudget; t: (key: string, opts?: Record<string, unknown>) => string }) {
  return (
    <span role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Caption style={{ color: 'var(--color-danger-text)' }}>{message}</Caption>
      {budget?.upgrade_hint?.next_tier_label && (
        <Caption>{t('koios.pendingAction.upgradeHint', { tier: budget.upgrade_hint.next_tier_label })}</Caption>
      )}
    </span>
  )
}

// The confirmed verdict: "Gelukt" plus the created record as a deep-link chip.
function ExecutedNotice({ created, t }: { created?: KoiosContextRef | null; t: (key: string) => string }) {
  return (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Caption style={{ color: 'var(--color-success-text)' }}>✓ {t('koios.pendingAction.confirmed')}</Caption>
      {created && <KoiosRefChip item={created} />}
    </span>
  )
}

// The chat handoff button — the ONE face on every row (icon-only, ghost), never a
// filled button on a row that happens to have no executable action.
function AskKoiosButton({ suggestion, onAskKoios, t }: { suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios; t: (key: string, opts?: Record<string, unknown>) => string }) {
  if (!onAskKoios) return null
  const label = t('koios.assistant.askKoios')
  return (
    <Button size="sm" variant="ghost" iconOnly aria-label={label} title={label}
      onClick={() => onAskKoios(t('koios.assistant.askIntent', { title: suggestion.title, body: suggestion.body }), contextRefsOf(suggestion))}>
      <MessageSquare size={13} />
    </Button>
  )
}

// One suggestion row: kind icon · deep-link chip (the title) · the reason · the actions.
function SuggestionRow({ suggestion, onAskKoios }: { suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios }) {
  const meta = KIND_META[suggestion.kind] ?? KIND_META.pending_action
  const Icon = meta.Icon
  const primaryRef = contextRefsOf(suggestion)[0]
  const [exec, setExec] = useState<ExecState>({ phase: 'idle' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 18, color: meta.color }}>
          <Icon size={13} />
        </span>
        {/* The record chip is the title AND the deep link; a suggestion without a record
            (a parked action) shows its title as plain text. */}
        {primaryRef
          ? <span style={{ flexShrink: 0 }}><KoiosRefChip item={primaryRef} /></span>
          : <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{suggestion.title}</span>}
        <Caption title={suggestion.body} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {suggestion.body}
        </Caption>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <SuggestionActions suggestion={suggestion} onAskKoios={onAskKoios} exec={exec} setExec={setExec} />
        </span>
      </div>
      {/* The staged leg (golf 3) sits under the row: the server's own preview of what
          WOULD happen — nothing ran yet — then Bevestigen/Annuleren. */}
      {suggestion.action && (exec.phase === 'staged' || (exec.phase === 'submitting' && exec.staged)) && (
        <StagedPreview exec={exec} setExec={setExec} />
      )}
    </div>
  )
}

// The preview + confirm/cancel of a staged descriptor action.
function StagedPreview({ exec, setExec }: { exec: ExecState; setExec: (s: ExecState) => void }) {
  const { t } = useTranslation('common')
  const st = exec.staged
  const run = useRun(setExec)
  return (
    <div style={{ marginLeft: 26, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Caption style={{ display: 'block' }}>
        {(st?.preview ?? []).filter(row => !isIdRow(row)).map(previewLine).join(' · ')}
      </Caption>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button size="sm" onClick={() => st && run(st.id, confirmPendingAction, 'executed', st.title)} disabled={exec.phase === 'submitting'}>
          {exec.phase === 'submitting' ? <Spinner size={12} /> : null} {t('koios.pendingAction.confirm')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => st && run(st.id, cancelPendingAction, 'cancelled')} disabled={exec.phase === 'submitting'}>
          {t('koios.pendingAction.cancel')}
        </Button>
      </div>
    </div>
  )
}

// Confirm/cancel share the shape: submit → server verdict (SERVER truth, not HTTP
// truth: a 200 whose status is not the expected verdict lands in the error branch).
// The verdict stays visible while the row stays rendered; a collapse/re-open or list
// swap remounts the row to live buttons — re-confirming then gets the server's own
// honest 410/422 ("al afgehandeld"), never a silent double-write.
function useRun(setExec: (s: ExecState) => void) {
  const { t } = useTranslation('common')
  return async (id: string, call: (id: string) => Promise<{ status?: string; message?: string; data?: unknown }>, done: 'executed' | 'cancelled', fallbackLabel?: string) => {
    setExec({ phase: 'submitting', staged: undefined })
    try {
      const body = await call(id)
      if (body?.status === done) {
        setExec({ phase: done, created: done === 'executed' ? createdRefFromToolResult(body.data, fallbackLabel ?? t('koios.assistant.createdTask')) : null })
      } else {
        setExec({ phase: 'error', message: body?.message ?? t('koios.pendingAction.error') })
      }
    } catch (err) {
      // KOIOS-CONFIRM-DECLINE-1: keep the server's message, and thread the
      // staffel stand through so the row can show the upgrade hint.
      const errBody = (err as { response?: { data?: { data?: { budget?: ActionBudget } } } })?.response?.data
      setExec({ phase: 'error', message: extractApiError(err, t('koios.pendingAction.error')), budget: errBody?.data?.budget })
    }
  }
}

// The action cluster on one row. kind=pending_action + its "pending_action" ref →
// confirm/cancel against POST /ai/koios/actions/{id}/confirm|cancel; a descriptor kind →
// stage (golf 3) next to the chat handoff; no action at all → the chat handoff only.
function SuggestionActions({ suggestion, onAskKoios, exec, setExec }: {
  suggestion: KoiosAssistantSuggestion; onAskKoios?: AskKoios; exec: ExecState; setExec: (s: ExecState) => void
}) {
  const { t } = useTranslation('common')
  const run = useRun(setExec)
  const pendingRef = suggestion.kind === 'pending_action'
    ? suggestion.refs.find(r => r.type === 'pending_action')
    : undefined

  // Golf 3 (CMBE 03f2630c): stage a descriptor's {tool,input} — parks only,
  // nothing executes; the preview + confirm step follow under the same row.
  const stage = async () => {
    if (!suggestion.action) return
    setExec({ phase: 'staging' })
    try {
      const body = await stagePendingAction(suggestion.action.tool, suggestion.action.input ?? {})
      if (body?.status === 'staged' && body?.action?.id) setExec({ phase: 'staged', staged: body.action as StagedAction })
      else setExec({ phase: 'error', message: body?.message ?? t('koios.pendingAction.error') })
    } catch (err) {
      setExec({ phase: 'error', message: extractApiError(err, t('koios.pendingAction.error')) })
    }
  }

  if (exec.phase === 'executed') return <ExecutedNotice created={exec.created} t={t} />
  if (exec.phase === 'cancelled') return <span role="status"><Caption>{t('koios.pendingAction.cancelled')}</Caption></span>
  if (exec.phase === 'error') return <ExecErrorNotice message={exec.message} budget={exec.budget} t={t} />

  if (pendingRef) {
    return (
      <>
        <Button size="sm" onClick={() => run(pendingRef.id, confirmPendingAction, 'executed', suggestion.title)} disabled={exec.phase === 'submitting'}>
          {exec.phase === 'submitting' ? <Spinner size={12} /> : null} {t('koios.pendingAction.confirm')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run(pendingRef.id, cancelPendingAction, 'cancelled')} disabled={exec.phase === 'submitting'}>
          {t('koios.pendingAction.cancel')}
        </Button>
      </>
    )
  }
  if (suggestion.action && (exec.phase === 'staged' || exec.phase === 'submitting')) return null
  return (
    <>
      {suggestion.action && (
        <Button size="sm" variant="secondary" onClick={stage} disabled={exec.phase === 'staging'}>
          {exec.phase === 'staging' ? <Spinner size={12} /> : null} {t('koios.assistant.execute')}
        </Button>
      )}
      <AskKoiosButton suggestion={suggestion} onAskKoios={onAskKoios} t={t} />
    </>
  )
}

// The Koios panel's assistant block: server-side suggestions rendered in order, collapsible via a persisted per-user choice.
export default function KoiosAssistantBlock({ onAskKoios, onClose }: { onAskKoios?: AskKoios; onClose?: () => void }) {
  const { t } = useTranslation('common')
  const { collapsed, setCollapsed } = useKoiosRadarCollapse('koios.assistant.collapsed')
  const { suggestions, loading, error, refetch } = useKoiosAssistant()
  const hasSuggestions = !loading && !error && suggestions.length > 0

  return (
    <KoiosCardFrame title={t('koios.assistant.title')} filled={hasSuggestions} open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)} onClose={onClose} closeLabel={t('close')}>
      {/* Four explicit UI states: loading / error / empty / non-zero suggestion rows. */}
      {loading && (
        <Caption style={{ display: 'block', margin: '6px 0 0' }}>{t('loading')}</Caption>
      )}
      {!loading && error && (
        <ErrorBanner variant="subtle" onRetry={() => refetch()} style={{ margin: '4px 0 0' }}>
          {t('error.body')}
        </ErrorBanner>
      )}
      {!loading && !error && suggestions.length === 0 && (
        <Caption style={{ display: 'block', margin: '6px 0 0' }}>{t('koios.assistant.emptyState')}</Caption>
      )}
      {!loading && !error && suggestions.length > 0 && (
        // The list scrolls inside the block (max ~half the panel) so the advice block
        // below stays reachable when the backend returns its full ten suggestions.
        <div style={{ margin: '4px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '48vh', overflowY: 'auto' }}>
          {suggestions.map(s => <SuggestionRow key={suggestionKey(s)} suggestion={s} onAskKoios={onAskKoios} />)}
        </div>
      )}
    </KoiosCardFrame>
  )
}
