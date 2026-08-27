/**
 * KoiosAssistantBlock — the assistant's opening move on the Koios panel's
 * landing state (KOIOS-ASSISTANT-FE-1, §0B: "an assistant finishes the
 * loop"). Renders GET /ai/koios/assistant's suggestions IN SERVER ORDER
 * (already urgency-sorted, never re-sorted here) as calm cards mirroring the
 * KoiosPendingActionCard visual family. Mounted above KoiosRadar — the
 * assistant speaks first, the attention signals follow. Collapsible via the
 * shared CollapsedCard, its own persisted storage key (mirrors
 * useKoiosRadarCollapse's convention exactly, one key per card).
 *
 * Golf 2: a parked action (kind pending_action + its "pending_action" ref)
 * executes via the real confirm/cancel seam; every other kind hands its intent
 * to the chat composer (prefill only — sending stays the user's click). A
 * parked action WITHOUT its ref (older BE) keeps the honest hint chip.
 */
import { useTranslation } from 'react-i18next'
import { Clock, UserX, Target, Briefcase, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CollapsedCard from '@/components/ui/CollapsedCard'
import { Caption, BodyText } from '@/components/ui/typography'
import SoftChip from '@/components/ui/SoftChip'
import ErrorBanner from '@/components/ui/ErrorBanner'
import KoiosResultCards from './KoiosResultCards'
import { useKoiosAssistant } from './useKoiosAssistant'
import { useKoiosRadarCollapse } from './useKoiosRadarCollapse'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { confirmPendingAction, cancelPendingAction } from './koiosApi'
import { extractApiError } from '@/lib/extractApiError'
import type { KoiosAssistantKind, KoiosAssistantSuggestion } from './useKoiosAssistant'

// Icon + semantic-token colour per suggestion kind (§4: colour carries meaning, never decoration).
const KIND_META: Record<KoiosAssistantKind, { Icon: LucideIcon; color: string }> = {
  pending_action:            { Icon: Sparkles,  color: 'var(--color-primary)' },
  task_overdue:              { Icon: Clock,      color: 'var(--color-warning-text)' },
  candidate_no_contact:      { Icon: UserX,      color: 'var(--color-warning-text)' },
  opportunity_closing_soon:  { Icon: Target,     color: 'var(--color-info)' },
  vacancy_zero_applications: { Icon: Briefcase,  color: 'var(--text-muted)' },
}

// One suggestion card: kind icon + title + body, its refs via the shared
// KoiosResultCards (deep-links + DATUM-1 already handled there), and an honest
// "action available" hint chip when the server attached a proposed tool call.
function SuggestionCard({ suggestion, onAskKoios }: { suggestion: KoiosAssistantSuggestion; onAskKoios?: (text: string) => void }) {
  const meta = KIND_META[suggestion.kind] ?? KIND_META.pending_action
  const Icon = meta.Icon
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: 20, height: 20, borderRadius: 6, color: meta.color }}>
          <Icon size={13} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{suggestion.title}</span>
      </div>
      <BodyText style={{ marginLeft: 28 }}>{suggestion.body}</BodyText>
      {suggestion.refs.length > 0 && (
        <div style={{ marginLeft: 28 }}>
          <KoiosResultCards refs={suggestion.refs} />
        </div>
      )}
      {/* Golf 2 (contract CMBE-gepind): a parked action gets the REAL confirm/
          cancel seam; every other kind hands off to the chat composer — sending
          stays the user's own explicit click (API-CREDITS-1 posture). */}
      <div style={{ marginLeft: 28, marginTop: 2 }}>
        <SuggestionActions suggestion={suggestion} onAskKoios={onAskKoios} />
      </div>
    </div>
  )
}

// Stable row identity (Opus golf-2 verify): the pending-action id when present,
// else kind+title — NEVER the array index, which glued one action's terminal
// state onto a DIFFERENT action after a refetch reshuffled the list.
function suggestionKey(s: KoiosAssistantSuggestion): string {
  const ref = s.refs.find(r => r.type === 'pending_action')
  return ref ? `pa:${ref.id}` : `${s.kind}:${s.title}`
}

// Per-suggestion execute state: idle → submitting → executed/cancelled/error(message).
type ExecState = { phase: 'idle' | 'submitting' | 'executed' | 'cancelled' | 'error'; message?: string }

// The action row under one suggestion. kind=pending_action + its "pending_action"
// ref (exact type value per AssistantSuggestions::pendingActionSuggestions) →
// confirm/cancel against POST /ai/koios/actions/{id}/confirm|cancel, rendering the
// SERVER truth: 200 status=executed → done; any 4xx → its message, unvarnished
// (an unwired tool falls into the 422-with-message branch by design, C9 widens
// coverage). Everything else → "finish in the chat" prefill (never auto-send).
function SuggestionActions({ suggestion, onAskKoios }: { suggestion: KoiosAssistantSuggestion; onAskKoios?: (text: string) => void }) {
  const { t } = useTranslation('common')
  const [exec, setExec] = useState<ExecState>({ phase: 'idle' })
  const pendingRef = suggestion.kind === 'pending_action'
    ? suggestion.refs.find(r => r.type === 'pending_action')
    : undefined

  // Confirm/cancel share the shape: submit → server verdict. The verdict stays
  // visible while the row stays rendered; a collapse/re-open or list swap
  // remounts the row to live buttons — re-confirming then gets the server's own
  // honest 410/422 ("al afgehandeld"), never a silent double-write.
  const run = async (call: (id: string) => Promise<{ status?: string; message?: string }>, done: 'executed' | 'cancelled') => {
    if (!pendingRef) return
    setExec({ phase: 'submitting' })
    try {
      // SERVER truth, not HTTP truth (Opus golf-2 verify): a 200 whose status is
      // not the expected verdict lands in the error branch with its message.
      const body = await call(pendingRef.id)
      if (body?.status === done) setExec({ phase: done })
      else setExec({ phase: 'error', message: body?.message ?? t('koios.pendingAction.error') })
    } catch (err) {
      setExec({ phase: 'error', message: extractApiError(err, t('koios.pendingAction.error')) })
    }
  }

  if (pendingRef) {
    if (exec.phase === 'executed') return <span role="status"><Caption style={{ color: 'var(--color-success-text)' }}>✓ {t('koios.pendingAction.confirmed')}</Caption></span>
    if (exec.phase === 'cancelled') return <span role="status"><Caption>{t('koios.pendingAction.cancelled')}</Caption></span>
    if (exec.phase === 'error') return <span role="alert"><Caption style={{ color: 'var(--color-danger-text)' }}>{exec.message}</Caption></span>
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button size="sm" onClick={() => run(confirmPendingAction, 'executed')} disabled={exec.phase === 'submitting'}>
          {exec.phase === 'submitting' ? <Spinner size={12} /> : null} {t('koios.pendingAction.confirm')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run(cancelPendingAction, 'cancelled')} disabled={exec.phase === 'submitting'}>
          {t('koios.pendingAction.cancel')}
        </Button>
      </div>
    )
  }
  // No parked action to execute: hand the intent to the chat composer (prefill+focus).
  if (onAskKoios) {
    return (
      <Button size="sm" variant="soft" onClick={() => onAskKoios(t('koios.assistant.askIntent', { title: suggestion.title }))}>
        {t('koios.assistant.askKoios')}
      </Button>
    )
  }
  // kind=pending_action WITHOUT its ref (older BE): the honest hint chip stays.
  return suggestion.action ? <SoftChip label={t('koios.assistant.actionAvailable')} color="var(--color-primary)" /> : null
}

// The Koios panel's landing-state assistant block: server-side suggestions rendered in order, collapsible via a persisted per-user choice.
export default function KoiosAssistantBlock({ onAskKoios }: { onAskKoios?: (text: string) => void }) {
  const { t } = useTranslation('common')
  const { collapsed, setCollapsed } = useKoiosRadarCollapse('koios.assistant.collapsed')
  // Only fetches while actually rendered — the panel only mounts this block on the landing state.
  const { suggestions, loading, error, refetch } = useKoiosAssistant()
  const hasSuggestions = !loading && !error && suggestions.length > 0

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', padding: '10px 14px' }}>
      <CollapsedCard
        title={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('koios.assistant.title')}</span>}
        filled={hasSuggestions}
        open={!collapsed}
        onOpenChange={(open) => setCollapsed(!open)}
      >
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
          <div style={{ margin: '4px 0 0', display: 'flex', flexDirection: 'column' }}>
            {suggestions.map(s => <SuggestionCard key={suggestionKey(s)} suggestion={s} onAskKoios={onAskKoios} />)}
          </div>
        )}
      </CollapsedCard>
    </div>
  )
}
