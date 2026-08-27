/**
 * KoiosFeedback — thumbs up/down on one Koios answer (KOIOS-FEEDBACK-FE-1).
 * Renders only when the host passes a `promptLogId` (the backend only logged
 * one for this answer — POST /ai/koios/feedback requires it). Up sends
 * immediately; down opens an inline reason picker (CHIP-TINT-1 choice chips,
 * ChipMultiSelect — a selection surface, not Button territory) plus an
 * optional single-line comment, sent via a real Button. §0B: the assistant
 * finishes the loop — a vote either truly lands or the user sees an honest
 * inline failure, never a fake "thanks".
 */
import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
// The one canon field face (§4) — never a hand-painted input identity.
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import CalloutBox from '@/components/ui/CalloutBox'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { Caption } from '@/components/ui/typography'
import { sendKoiosFeedback } from './koiosApi'
import type { TFn } from '@/types/koios'

// KOIOS-FEEDBACK-FE-1: the WORKLIST's five reasons — the generated spec's
// requestBody only carries an untyped `reasons?: string[]` (no enum in
// api-generated.ts to measure against, see openQuestions), so this list is
// the agreed vocabulary until the backend documents its own.
const REASONS = ['inaccurate', 'incomplete', 'harmful', 'tone', 'other'] as const

type Status = 'idle' | 'reasoning' | 'sending' | 'sent' | 'error'

interface KoiosFeedbackProps {
  promptLogId?: string
  // The full server vocabulary (KoiosFeedback model, CMBE-gemeten 28-08); only
  // chat (and later note_assist) have UI homes today.
  surface: 'chat' | 'note_assist' | 'generate' | 'conversation_assist' | 'report_advice'
  t: TFn
}

// One message's vote widget — up/down icons, an inline reason+comment form for down.
export default function KoiosFeedback({ promptLogId, surface, t }: KoiosFeedbackProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [rating, setRating] = useState<'up' | 'down' | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [comment, setComment] = useState('')

  if (!promptLogId) return null

  // Toggle one reason chip in/out of the selected set.
  const toggleReason = (value: string) =>
    setReasons((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]))

  // Send the vote; a down carries the reasons/comment collected in the inline form.
  const submit = async (nextRating: 'up' | 'down', body?: { reasons?: string[]; comment?: string }) => {
    setRating(nextRating)
    setStatus('sending')
    try {
      await sendKoiosFeedback({
        prompt_log_id: promptLogId,
        surface,
        rating: nextRating,
        ...(body?.reasons?.length ? { reasons: body.reasons } : {}),
        ...(body?.comment?.trim() ? { comment: body.comment.trim() } : {}),
      })
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  // Locked after a successful vote — no re-vote UI (§0B honesty: what happened, happened).
  if (status === 'sent') {
    return <Caption as="div">{t('koios.feedback.thanks', { defaultValue: 'Bedankt voor je feedback' })}</Caption>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {status !== 'error' && <div style={{ display: 'flex', gap: 4 }}>
        <Button iconOnly variant="ghost" size="sm" aria-label={t('koios.feedback.up', { defaultValue: 'Nuttig' })}
          disabled={status === 'sending'} onClick={() => submit('up')}>
          <ThumbsUp size={12} />
        </Button>
        <Button iconOnly variant="ghost" size="sm" aria-label={t('koios.feedback.down', { defaultValue: 'Niet nuttig' })}
          disabled={status === 'sending'} onClick={() => setStatus('reasoning')}>
          <ThumbsDown size={12} />
        </Button>
      </div>}

      {status === 'reasoning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ChipMultiSelect
            options={REASONS.map((r) => ({ value: r, label: t(`koios.feedback.reasons.${r}`, { defaultValue: r }) }))}
            values={reasons} onToggle={toggleReason} selectAll={false}
            ariaLabel={t('koios.feedback.reasonsLabel', { defaultValue: 'Reden' })} />
          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500}
            placeholder={t('koios.feedback.commentPlaceholder', { defaultValue: 'Toelichting (optioneel)' })}
            aria-label={t('koios.feedback.commentPlaceholder', { defaultValue: 'Toelichting (optioneel)' })}
            style={fieldInputStyle} />
          <Button variant="primary" size="sm" disabled={status !== 'reasoning' || reasons.length === 0}
            title={reasons.length === 0 ? t('koios.feedback.reasonRequired', { defaultValue: 'Kies minstens één reden' }) : undefined}
            onClick={() => submit('down', { reasons, comment })}>
            {t('koios.feedback.send', { defaultValue: 'Versturen' })}
          </Button>
        </div>
      )}

      {status === 'error' && (
        <CalloutBox variant="danger">
          {t('koios.feedback.error', { defaultValue: 'Feedback versturen is niet gelukt. Probeer het opnieuw.' })}
        </CalloutBox>
      )}
      {status === 'error' && rating && (
        <Button variant="secondary" size="sm" onClick={() => (rating === 'up' ? submit('up') : setStatus('reasoning'))}>
          {t('koios.feedback.retry', { defaultValue: 'Opnieuw proberen' })}
        </Button>
      )}
    </div>
  )
}
