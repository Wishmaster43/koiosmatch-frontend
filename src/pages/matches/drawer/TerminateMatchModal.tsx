/**
 * TerminateMatchModal — MATCH-TERMINATE-1: the "Beëindigen" ("Terminate")
 * confirm form. POSTs { stop_reason, effective_date, note? } to
 * /matches/{id}/terminate; the backend closes the match via the tenant's
 * is_closed-flagged status and returns the full updated match, which
 * useMatchTerminate maps + hands to the drawer's existing onUpdate refresh
 * path. A 422 keeps the modal open with the server's field-level messages
 * surfaced inline (mirrors no other modal doing per-field errors yet — this
 * is the first, so errors are shown under each field rather than a single
 * toast).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ReasonModalHeader from '@/components/ui/ReasonModalHeader'
import { useReasonSubmit } from '@/hooks/useReasonSubmit'
import { useMatchStopReasons } from '@/hooks/useMatchStopReasons'
import { useMatchTerminate } from '../hooks/useMatchTerminate'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import type { MatchRow } from '@/types/match'
import MatchConfirmFooter from './MatchConfirmFooter'
import DictationTextarea from '@/components/forms/DictationTextarea'
import { Caption } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'

// Canon field style (G33/fieldMetrics) — was its own padding-8/radius-8 copy;
// fieldBox covers the single-line date input + the disabled-lookup notice;
// the note field is the shared DictationTextarea (POP-UPS 4) with its own canon.
const fieldBox: CSSProperties = fieldInputStyle
const errorText: CSSProperties = { fontSize: 11, color: 'var(--color-danger-text)', marginTop: 4 }
const NOTE_MAX = 2000
const NOTE_COUNTER_FROM = 1800

// Today as an input[type=date] value (YYYY-MM-DD), in LOCAL time — never
// toISOString() (UTC), which flips the date near midnight for most of Europe.
// Kept local rather than importing tasks/addmodal/defaults (CLAUDE.md §2: an
// entity page never reaches into another entity's internals) — this mirrors
// that file's own todayISO, a tiny pure function with the same shape.
function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

interface Props {
  match: MatchRow
  onClose: () => void
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

// The "Beëindigen" confirm form: reason + effective date + optional note,
// posting the exact terminate contract and surfacing 422s inline per field.
export default function TerminateMatchModal({ match, onClose, onUpdate }: Props) {
  const { t } = useTranslation(['matches', 'common'])
  // Locale-aware thousands separator for the character counter (GETALLEN-1).
  const { formatNumber } = useNumberFormat()
  // Reason lookup — tenant-managed, no seed (see useMatchStopReasons doc comment).
  const { reasons, loading: reasonsLoading } = useMatchStopReasons()
  const { terminate, saving } = useMatchTerminate(match.id, onUpdate)

  const [stopReason, setStopReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => todayISO())
  const [note, setNote] = useState('')

  const noReasonsConfigured = !reasonsLoading && reasons.length === 0
  const canSubmit = Boolean(stopReason) && Boolean(effectiveDate) && !saving

  // Shared guard/success/422 submit flow (clone: also used by RenewMatchModal) —
  // builds the exact contract body, surfaces 422 field errors inline (modal stays
  // open), else a generic toast; success notifies + closes.
  const { submit, fieldErrors } = useReasonSubmit({
    canSubmit,
    action: () => terminate({ stop_reason: stopReason, effective_date: effectiveDate, note: note.trim() || undefined }),
    successMessage: t('drawer.terminate.success'),
    errorMessage: t('drawer.terminate.error'),
    onClose,
  })

  return (
    // POPUP-SLEEP-1: shell swapped onto the shared FloatingPanel (draggable/
    // resizable, remembered position) — body/footer and flows unchanged.
    <FloatingPanel open onClose={onClose} ariaLabel={t('drawer.terminate.modalTitle')}
      persistKey="match-terminate" width={460} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={<ReasonModalHeader icon={Ban} iconBg="var(--color-danger-bg)" iconColor="var(--color-on-danger-bg)" title={t('drawer.terminate.modalTitle')} titleWeight={700} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Reason — searchable tenant lookup (allowCreate off: a stop reason is
              picked, never free-typed). No seed fallback: an honest disabled
              notice replaces the picker when the tenant hasn't configured any yet. */}
          <div>
            <Caption as="div" style={{ marginBottom: 5 }}>{t('drawer.terminate.reasonLabel')}</Caption>
            {noReasonsConfigured ? (
              <div style={{ ...fieldBox, color: 'var(--text-muted)', fontStyle: 'italic', cursor: 'default' }}>
                {t('drawer.terminate.noReasonsConfigured')}
              </div>
            ) : (
              <CreatableSelect allowCreate={false} value={stopReason || null} onChange={setStopReason}
                placeholder={t('drawer.terminate.reasonPlaceholder')}
                options={reasons.map(r => ({ value: r.value, label: r.label }))} />
            )}
            {fieldErrors.stop_reason && <div style={errorText}>{fieldErrors.stop_reason}</div>}
          </div>

          {/* Effective date — defaults to today, the recruiter can back/forward-date it. */}
          <div>
            <Caption as="div" style={{ marginBottom: 5 }}>{t('drawer.terminate.effectiveDateLabel')}</Caption>
            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
              aria-label={t('drawer.terminate.effectiveDateLabel')} style={fieldBox} />
            {fieldErrors.effective_date && <div style={errorText}>{fieldErrors.effective_date}</div>}
          </div>

          {/* Note — optional, plain textarea (short structured "why", same documented
              exception as DetachReasonModal/StatusReasonModal — never rich text). */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <Caption>{t('drawer.terminate.noteLabel')}</Caption>
              {note.length > NOTE_COUNTER_FROM && (
                <Caption as="span">{t('drawer.terminate.noteCounter', { count: formatNumber(note.length), max: formatNumber(NOTE_MAX) })}</Caption>
              )}
            </div>
            {/* POP-UPS 4: de toelichting krijgt de house-mic (plain-text dictatie) —
                "the note field gets the house mic (plain-text dictation)". */}
            <DictationTextarea value={note} rows={3} onChange={v => setNote(v.slice(0, NOTE_MAX))}
              placeholder={t('drawer.terminate.notePlaceholder')} aria-label={t('drawer.terminate.noteLabel')} />
            {fieldErrors.note && <div style={errorText}>{fieldErrors.note}</div>}
          </div>
        </div>

        <MatchConfirmFooter onCancel={onClose} cancelLabel={t('common:cancel')}
          onSubmit={submit} submitLabel={t('drawer.terminate.confirm')} danger disabled={!canSubmit} />
    </FloatingPanel>
  )
}
