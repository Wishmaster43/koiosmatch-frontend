import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useDateFormat } from '@/lib/datetime'
import { useMatchRenew } from '../hooks/useMatchRenew'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import type { MatchRow } from '@/types/match'
import Button from '@/components/ui/Button'

// Canon field style (G33/fieldMetrics) — was its own padding-8/radius-8 copy.
const fieldBox: CSSProperties = fieldInputStyle
const errorText: CSSProperties = { fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }

// One day after a YYYY-MM-DD date, in LOCAL time (never Date#toISOString(), which
// is UTC and flips the date near midnight for most of Europe) — feeds the date
// input's `min` so the browser's own picker already refuses an invalid pick,
// mirroring the exact rule MatchRenewalService re-checks server-side.
function dayAfterISO(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface Props {
  match: MatchRow
  onClose: () => void
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

/**
 * RenewMatchModal — G04/MATCH-RENEWAL-1: the "Verlengen" confirm form, the mirror
 * of TerminateMatchModal (same FloatingPanel idiom, same guard/confirm pattern,
 * same success/refetch handling). POSTs { new_end_date } to /matches/{id}/renew
 * (MatchController::renew → MatchRenewalService) — no reason/duration in the
 * contract, unlike terminate: a renewal only ever pushes end_date forward and
 * records the step in the match's renewal chain. The backend returns the full
 * updated match, mapped + handed to the drawer's existing onUpdate refresh path.
 * A 422 (e.g. the picked date is not after the current end_date, re-checked
 * against the LOCKED row) keeps the modal open with the server's message shown
 * inline under the field.
 */
export default function RenewMatchModal({ match, onClose, onUpdate }: Props) {
  const { t } = useTranslation(['matches', 'common'])
  const { formatDate } = useDateFormat()
  const { renew, saving } = useMatchRenew(match.id, onUpdate)

  const currentEndDate = match.endDate ?? null
  // Deliberately no pre-filled default (unlike terminate's "today", which is
  // always a valid effective date): the one valid lower bound here depends on
  // the match's current end_date, so a blank field forces a deliberate pick
  // instead of showing a misleading pre-filled-but-invalid date on open.
  const [newEndDate, setNewEndDate] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Client-side mirror of the backend guard (MatchRenewalService): a null
  // current end_date accepts any date; otherwise the new date must be strictly
  // AFTER it. Advisory only — the server re-checks against the locked row and
  // stays the real authority (see the 422 branch below).
  const dateTooEarly = Boolean(currentEndDate) && Boolean(newEndDate) && newEndDate <= (currentEndDate as string)
  const canSubmit = Boolean(newEndDate) && !dateTooEarly && !saving

  // Submit: build the exact contract body, surface a 422 field error inline
  // (modal stays open), else a generic toast; success notifies + closes so the
  // caller's onUpdate (already fired inside the hook) is the single refresh path.
  const submit = async () => {
    if (!canSubmit) return
    setFieldErrors({})
    try {
      await renew({ new_end_date: newEndDate })
      notifySuccess(t('drawer.renew.success'))
      onClose()
    } catch (err) {
      const body = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data
      if (body?.errors) {
        const next: Record<string, string> = {}
        Object.entries(body.errors).forEach(([k, v]) => { if (v?.[0]) next[k] = v[0] })
        setFieldErrors(next)
      } else {
        notifyError(extractApiError(err, t('drawer.renew.error')))
      }
    }
  }

  return (
    // POPUP-SLEEP-1 idiom (same shell TerminateMatchModal uses): the shared
    // FloatingPanel (draggable/resizable, remembered position).
    <FloatingPanel open onClose={onClose} ariaLabel={t('drawer.renew.modalTitle')}
      persistKey="match-renew" width={420} maxWidth="92vw"
      bodyStyle={{ padding: 20 }}
      header={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}><RefreshCw size={16} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('drawer.renew.modalTitle')}</span>
        </span>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Current end date — read-only context so the recruiter knows what they're
              extending; the match may be open-ended, in which case any date is valid. */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {currentEndDate
              ? t('drawer.renew.currentEndDate', { date: formatDate(currentEndDate) })
              : t('drawer.renew.noCurrentEndDate')}
          </div>

          {/* New end date — the only field the contract accepts (no reason/duration). */}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{t('drawer.renew.newEndDateLabel')}</div>
            <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
              min={currentEndDate ? dayAfterISO(currentEndDate) : undefined}
              aria-label={t('drawer.renew.newEndDateLabel')} style={fieldBox} />
            {fieldErrors.new_end_date && <div style={errorText}>{fieldErrors.new_end_date}</div>}
            {!fieldErrors.new_end_date && dateTooEarly && <div style={errorText}>{t('drawer.renew.mustBeAfterCurrent')}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <button onClick={submit} disabled={!canSubmit}
            style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
              background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.6 }}>
            {t('drawer.renew.confirm')}
          </button>
        </div>
    </FloatingPanel>
  )
}
