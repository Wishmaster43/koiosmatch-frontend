import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useMatchStopReasons } from '../hooks/useMatchStopReasons'
import { useMatchTerminate } from '../hooks/useMatchTerminate'
import { fieldInputStyle, fieldTextareaStyle } from '@/components/forms/fieldMetrics'
import type { MatchRow } from '@/types/match'
import Button from '@/components/ui/Button'

// Canon field style (G33/fieldMetrics) — was its own padding-8/radius-8 copy;
// fieldBox covers the single-line date input + the disabled-lookup notice,
// noteBox covers the multi-line textarea below (height doesn't apply there).
const fieldBox: CSSProperties = fieldInputStyle
const noteBox: CSSProperties = fieldTextareaStyle
const errorText: CSSProperties = { fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }
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

/**
 * TerminateMatchModal — MATCH-TERMINATE-1: the "Beëindigen" confirm form.
 * POSTs { stop_reason, effective_date, note? } to /matches/{id}/terminate; the
 * backend closes the match via the tenant's is_closed-flagged status and
 * returns the full updated match, which useMatchTerminate maps + hands to the
 * drawer's existing onUpdate refresh path. A 422 keeps the modal open with the
 * server's field-level messages surfaced inline (mirrors no other modal doing
 * per-field errors yet — this is the first, so errors are shown under each
 * field rather than a single toast).
 */
export default function TerminateMatchModal({ match, onClose, onUpdate }: Props) {
  const { t } = useTranslation(['matches', 'common'])
  // Reason lookup — tenant-managed, no seed (see useMatchStopReasons doc comment).
  const { reasons, loading: reasonsLoading } = useMatchStopReasons()
  const { terminate, saving } = useMatchTerminate(match.id, onUpdate)

  const [stopReason, setStopReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(() => todayISO())
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const noReasonsConfigured = !reasonsLoading && reasons.length === 0
  const canSubmit = Boolean(stopReason) && Boolean(effectiveDate) && !saving

  // Submit: build the exact contract body, surface 422 field errors inline
  // (modal stays open), else a generic toast; success notifies + closes so the
  // caller's onUpdate (already fired inside the hook) is the single refresh path.
  const submit = async () => {
    if (!canSubmit) return
    setFieldErrors({})
    try {
      await terminate({ stop_reason: stopReason, effective_date: effectiveDate, note: note.trim() || undefined })
      notifySuccess(t('drawer.terminate.success'))
      onClose()
    } catch (err) {
      const body = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data
      if (body?.errors) {
        const next: Record<string, string> = {}
        Object.entries(body.errors).forEach(([k, v]) => { if (v?.[0]) next[k] = v[0] })
        setFieldErrors(next)
      } else {
        notifyError(extractApiError(err, t('drawer.terminate.error')))
      }
    }
  }

  return (
    // POPUP-SLEEP-1: shell swapped onto the shared FloatingPanel (draggable/
    // resizable, remembered position) — body/footer and flows unchanged.
    <FloatingPanel open onClose={onClose} ariaLabel={t('drawer.terminate.modalTitle')}
      persistKey="match-terminate" width={460} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}><Ban size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('drawer.terminate.modalTitle')}</span>
        </span>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Reason — searchable tenant lookup (allowCreate off: a stop reason is
              picked, never free-typed). No seed fallback: an honest disabled
              notice replaces the picker when the tenant hasn't configured any yet. */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.terminate.reasonLabel')}</div>
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
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.terminate.effectiveDateLabel')}</div>
            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
              aria-label={t('drawer.terminate.effectiveDateLabel')} style={fieldBox} />
            {fieldErrors.effective_date && <div style={errorText}>{fieldErrors.effective_date}</div>}
          </div>

          {/* Note — optional, plain textarea (short structured "why", same documented
              exception as DetachReasonModal/StatusReasonModal — never rich text). */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.terminate.noteLabel')}</span>
              {note.length > NOTE_COUNTER_FROM && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('drawer.terminate.noteCounter', { count: note.length, max: NOTE_MAX })}</span>
              )}
            </div>
            <textarea value={note} maxLength={NOTE_MAX} onChange={e => setNote(e.target.value)}
              placeholder={t('drawer.terminate.notePlaceholder')} rows={3}
              aria-label={t('drawer.terminate.noteLabel')} style={noteBox} />
            {fieldErrors.note && <div style={errorText}>{fieldErrors.note}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button variant="danger" onClick={submit} disabled={!canSubmit}>
            {t('drawer.terminate.confirm')}
          </Button>
        </div>
    </FloatingPanel>
  )
}
