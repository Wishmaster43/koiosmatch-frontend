/**
 * ConversationAssistSection — the Koios AI assist affordance inside an open
 * WhatsApp thread's session composer (G27 / K2-CONV-ASSIST-1). Mirrors
 * NoteAssistSection's original knop→preview→Overnemen/Verwerpen idiom (never
 * auto-applies) — but runs over the THREAD's own stored messages (no client
 * text sent) and its apply target is the composer's plain-text DRAFT, not a
 * rich-text body, so `onApply` simply replaces the draft string and `discard`
 * leaves it untouched. Only "summarize"/"actions" exist here (the backend has
 * no "improve" mode for a conversation — there is no existing draft reply to
 * rewrite). A cross-import of tabs/notes/noteAssistApi.ts was deliberately
 * avoided: that folder is out of this job's owned scope (G27), so the shape
 * is mirrored here rather than shared/forked.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AlignLeft, ListChecks, Loader2, Check, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import CalloutBox from '@/components/ui/CalloutBox'
import { useConversationAssist } from './useConversationAssist'
import { formatAssistResultForDraft } from './conversationAssistApply'
import { ACTION_TYPE_LABEL_NL } from './conversationAssistApi'
import type { ConversationAssistMode, ConversationAssistActionType } from './conversationAssistApi'
import type { Id } from '@/types/common'

interface ConversationAssistSectionProps {
  conversationId: Id
  // Whether the currently loaded thread has any messages — the ONE honest gate
  // (§3: no fake affordance) on running assist; buttons stay visible but disabled.
  hasMessages: boolean
  // Applies the result straight into the caller's composer draft state.
  onApply: (draftText: string) => void
  language?: string
}

const actionBtn = (active: boolean, disabled: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
  padding: '5px 9px', borderRadius: 7, cursor: disabled ? 'default' : 'pointer',
  background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
  border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
  opacity: disabled && !active ? 0.5 : 1,
})
const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }
const ghostBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }

// Dutch fallback copy (DEFAULT-VALUE-1) — mode button label.
const MODE_LABEL_NL: Record<ConversationAssistMode, string> = { summarize: 'Samenvatten', actions: 'Actiepunten' }

// One row per mode — icon + i18n key share the mode name, mirrors NoteAssistSection's MODES array.
const MODES: { mode: ConversationAssistMode; icon: typeof AlignLeft }[] = [
  { mode: 'summarize', icon: AlignLeft },
  { mode: 'actions', icon: ListChecks },
]

export default function ConversationAssistSection({ conversationId, hasMessages, onApply, language }: ConversationAssistSectionProps) {
  const { t } = useTranslation('candidates')
  const { mode, status, result, errorMessage, tone, run, discard } = useConversationAssist(language)
  const loading = status === 'loading'

  // "Overnemen" — replace the composer draft with the formatted result, then
  // clear the suggestion so a stale result can never be applied twice.
  const handleApply = () => {
    if (!result) return
    onApply(formatAssistResultForDraft(result, (type) => t(`conversations.assist.actionTypes.${type}`, { defaultValue: ACTION_TYPE_LABEL_NL[type as ConversationAssistActionType] ?? type })))
    discard()
  }

  return (
    <div style={{ marginTop: 4, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <KoiosAiMark size={14} />
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          {t('conversations.assist.title')}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {MODES.map(({ mode: m, icon: Icon }) => (
          <button key={m} type="button" onClick={() => run(m, conversationId)} disabled={loading || !hasMessages}
            title={hasMessages ? undefined : t('conversations.assist.needsMessages', { defaultValue: 'Dit gesprek heeft nog geen berichten' })}
            style={actionBtn(loading && mode === m, loading || !hasMessages)}>
            {loading && mode === m ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            {t(`conversations.assist.${m}`, { defaultValue: MODE_LABEL_NL[m] })}
          </button>
        ))}
      </div>
      {/* Honest, VISIBLE reason the buttons are disabled — never a hover-only title (§3). */}
      {!hasMessages && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
          {t('conversations.assist.needsMessages', { defaultValue: 'Dit gesprek heeft nog geen berichten' })}
        </div>
      )}

      {/* Failure — the server's own message (budget/unavailable read calm via
          CalloutBox warning tone; a real error stays danger). The mode buttons
          stay visible above, so the recruiter can retry right away. */}
      {status === 'error' && (
        <div style={{ marginBottom: 6 }}>
          <CalloutBox variant={tone === 'warning' ? 'warning' : 'danger'}>{errorMessage}</CalloutBox>
        </div>
      )}

      {status === 'success' && result && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {result.kind === 'text' ? (
            // Plain prose preview (never dangerouslySetInnerHTML — the model's
            // reply is rendered as TEXT content, §7).
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, maxHeight: 140, overflow: 'auto' }}>{result.text}</div>
          ) : result.items.length > 0 ? (
            // Actions with items: a compact review list — title + type + due date.
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {result.items.map((it, idx) => (
                <li key={idx} style={{ fontSize: 12, color: 'var(--text)' }}>
                  <strong>{it.title}</strong>
                  {' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    ({t(`conversations.assist.actionTypes.${it.type}`, { defaultValue: ACTION_TYPE_LABEL_NL[it.type] })}
                    {it.due_date ? ` · ${it.due_date}` : ''})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            // Actions with zero items — nothing to run, calm empty notice.
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('conversations.assist.noItems', { defaultValue: 'Geen actiepunten gevonden' })}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* No apply target when actions came back empty — nothing to overnemen. */}
            {(result.kind === 'text' || result.items.length > 0) && (
              <button type="button" onClick={handleApply} style={primaryBtn}><Check size={13} /> {t('conversations.assist.apply', { defaultValue: 'Overnemen' })}</button>
            )}
            <button type="button" onClick={discard} style={ghostBtn}><X size={13} /> {t('conversations.assist.discard', { defaultValue: 'Verwerpen' })}</button>
          </div>
        </div>
      )}
    </div>
  )
}
