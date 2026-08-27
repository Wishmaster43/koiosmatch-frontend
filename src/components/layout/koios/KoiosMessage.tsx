/**
 * KoiosMessage — one chat bubble in the panel's message list, plus the
 * resolveMessage helper that maps a chat message to its display text/notice
 * flag. Split out of KoiosPanel (§0.3 size discipline, KOIOSPANEL-SPLIT-1) —
 * purely presentational, all chat state lives in useKoiosChat; the shared
 * GRADIENT + resolveMessage live in koiosMessageParts (non-component module).
 */
import { Bot } from 'lucide-react'
import SafeHtml from '@/components/ui/SafeHtml'
import { humanizeIsoDates } from '@/lib/localDate'
import { koiosMarkdownToHtml } from './koiosMarkdown'
import KoiosSteps from './KoiosSteps'
import KoiosUsage from './KoiosUsage'
import KoiosPendingActionCard from './KoiosPendingActionCard'
import KoiosResultCards from './KoiosResultCards'
import KoiosFeedback from './KoiosFeedback'
import type { KoiosResultRef } from './koiosTypes'
import type { KoiosChatMessage, TFn } from '@/types/koios'
import { GRADIENT, resolveMessage } from './koiosMessageParts'
import type { KoiosModelOption } from '@/lib/koiosModelTiers'

// ── Chat bubble ───────────────────────────────────────────────────────────────
export default function KoiosMessage({ msg, isNew, t, locale, modelOptions }: { msg: KoiosChatMessage; isNew?: boolean; t: TFn; locale?: string; modelOptions?: KoiosModelOption[] }) {
  const isKoios = msg.role !== 'user'
  const { text, notice } = resolveMessage(msg, t)
  // Subtle tag under the bubble for a self-refusal or an unfinished (max_steps) run.
  const stopTag = isKoios && !notice && msg.stopReason === 'refusal' ? t('koios.stopRefused')
    : isKoios && !notice && msg.stopReason === 'max_steps' ? t('koios.stopMaxSteps') : null
  // Job 3 (dormant): flatten every step's `refs[]` into one deep-link card row.
  const resultRefs: KoiosResultRef[] = (msg.steps ?? []).flatMap((s) => s.refs ?? [])

  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isKoios ? 'row' : 'row-reverse',
      alignItems: 'flex-end', animation: isNew ? 'fadeSlideIn 0.2s ease' : 'none' }}>
      {isKoios && (
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginBottom: 2,
          background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* GRADIENT embeds the tenant accent — the on-accent token, not a hardcoded white. */}
          <Bot size={13} color="var(--color-on-accent)" />
        </div>
      )}
      <div style={{ maxWidth: '84%', display: 'flex', flexDirection: 'column',
        alignItems: isKoios ? 'flex-start' : 'flex-end' }}>
        <div style={{
          padding: '9px 13px',
          borderRadius: isKoios ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          fontSize: 13, lineHeight: 1.6, whiteSpace: isKoios && !notice ? 'normal' : 'pre-wrap',
          background: isKoios ? 'var(--surface)' : GRADIENT,
          color:      isKoios ? (notice ? 'var(--text-muted)' : 'var(--text)') : 'var(--color-on-accent)',
          border:     isKoios ? '1px solid var(--border)' : 'none',
          // HUISSTIJL-1: colored glow tied to the gradient bubble background, none of card/float/modal — kept.
          boxShadow:  isKoios ? 'none' : '0 2px 10px rgba(99,102,241,0.35)',
        }}>
          {/* DATUM-1: rewrite any AI-composed ISO date to DD-MM-YYYY before markdown/DOMPurify; assistant replies render basic markdown (bold/lists) through SafeHtml, user text and notices stay plain. */}
          {isKoios && !notice ? <SafeHtml html={koiosMarkdownToHtml(humanizeIsoDates(text ?? ''))} /> : text}
        </div>
        {stopTag && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>{stopTag}</div>}
        {/* Job 2 (dormant): a proposed write waiting for the user's confirm/cancel. */}
        {isKoios && !notice && msg.pendingAction && <KoiosPendingActionCard action={msg.pendingAction} />}
        {/* Job 3 (dormant): deep-link cards for any refs a read-tool step returned. */}
        {isKoios && !notice && resultRefs.length > 0 && <KoiosResultCards refs={resultRefs} />}
        {isKoios && !notice && <KoiosSteps steps={msg.steps} t={t} />}
        {isKoios && !notice && msg.stopReason !== 'not_configured' && (
          <KoiosUsage usage={msg.usage} model={msg.model} t={t} locale={locale} options={modelOptions} />
        )}
        {/* KOIOS-FEEDBACK-FE-1: thumbs up/down, only when the backend logged this answer. */}
        {isKoios && !notice && msg.prompt_log_id && (
          <div style={{ marginTop: 4 }}>
            <KoiosFeedback promptLogId={msg.prompt_log_id} surface="chat" t={t} />
          </div>
        )}
      </div>
    </div>
  )
}
