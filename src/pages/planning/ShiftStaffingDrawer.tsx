/**
 * ShiftStaffingDrawer (SHIFT-STAFF-1) — staff one shift on the real API: the
 * assigned roster (unassign / cancel-with-reason / checkout) plus the eligible
 * pool to assign from (favourite marker + the backend's own reason text — never
 * an invented one). Opened from a shift pill on the calendar (PlanningPage).
 *
 * Every action hits the routes verified live in koiosmatch-api today — see
 * ./hooks/useShiftStaffing for the exact endpoints/bodies. Guards are surfaced
 * honestly: a 409 means this candidate is already on this shift, a 422 names
 * the clashing shift via the server's own message (extractApiError), never a
 * generic "something went wrong".
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, UserMinus, Ban, LogOut, AlertCircle, Check } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import Button from '@/components/ui/Button'
import { Caption } from '@/components/ui/typography'
import { tintBg } from '@/lib/tint'
import { useDateFormat } from '@/lib/datetime'
import { extractApiError } from '@/lib/extractApiError'
import { useShiftEligibleCandidates, usePlanningCancellationReasons, useShiftStaffingMutations } from './hooks/useShiftStaffing'
import type { PlanningBoardShift } from './hooks/usePlanningBoard'

const INPUT = { padding: '8px 11px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  outline: 'none', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' } as const

interface Props { shift: PlanningBoardShift; onClose: () => void }

export default function ShiftStaffingDrawer({ shift, onClose }: Props) {
  const { t } = useTranslation('planning')
  const { formatDateTime } = useDateFormat()
  const { candidates: eligible, loading: eligibleLoading, error: eligibleError } = useShiftEligibleCandidates(shift.id)
  const { reasons, loading: reasonsLoading } = usePlanningCancellationReasons()
  const { assign, unassign, cancel, checkout } = useShiftStaffingMutations(shift.id)

  // Per-row transient state: which schedule is mid-cancel or mid-checkout, and
  // the last request's honest error message (never a silent failure, §3).
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [actualBreak, setActualBreak] = useState('')
  const [error, setError] = useState('')
  const [lastCheckout, setLastCheckout] = useState<{ scheduleId: string; hours: number | null } | null>(null)

  // Only the currently-active (non-cancelled) assignees count against the pool;
  // a cancelled row still shows for the record but its spot is already freed.
  const active = shift.assigned.filter(a => a.status !== 'cancelled' && a.status !== 'no_show')

  const handleAssign = (candidateId: string) => {
    setError('')
    assign.mutate(candidateId, {
      onError: err => setError(extractApiError(err, t('staffing.assignError'))),
    })
  }

  const handleUnassign = (scheduleId: string) => {
    setError('')
    unassign.mutate(scheduleId, { onError: err => setError(extractApiError(err, t('staffing.unassignError'))) })
  }

  const startCancel = (scheduleId: string) => { setCancelling(scheduleId); setCancelReason(''); setError('') }
  const submitCancel = (scheduleId: string) => {
    if (!cancelReason) return
    setError('')
    cancel.mutate({ scheduleId, status: 'cancelled', reason: cancelReason }, {
      onSuccess: () => setCancelling(null),
      onError: err => setError(extractApiError(err, t('staffing.cancelError'))),
    })
  }

  const startCheckout = (scheduleId: string) => {
    setCheckingOut(scheduleId); setActualStart(shift.startTime ?? ''); setActualEnd(shift.endTime ?? ''); setActualBreak(''); setError('')
  }
  const submitCheckout = (scheduleId: string) => {
    if (!actualStart || !actualEnd) return
    setError('')
    checkout.mutate({ scheduleId, actualStart, actualEnd, actualBreakMinutes: actualBreak ? Number(actualBreak) : undefined }, {
      onSuccess: row => { setCheckingOut(null); setLastCheckout({ scheduleId, hours: row.actualTotalHours }) },
      onError: err => setError(extractApiError(err, t('staffing.checkoutError'))),
    })
  }

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={t('staffing.title')}
      persistKey="shift-staffing" width={640} maxWidth="92vw"
      header={
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('staffing.title')}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
            {shift.function || shift.shiftType || ''} · {formatDateTime(shift.startTime)}
          </span>
        </div>
      }>

      {/* Honest, request-level error banner — never swallowed. */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', marginBottom: 12,
          background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', borderRadius: 8 }}>
          <AlertCircle size={13} style={{ color: 'var(--color-danger)', flexShrink: 0 }} aria-hidden="true" />
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</span>
        </div>
      )}

      {/* ── Assigned roster ── */}
      <div style={{ marginBottom: 18 }}>
        <div style={cardHead}>{t('staffing.assigned')} ({active.length}/{shift.numberPersons})</div>
        <div style={cardBox}>
          {shift.assigned.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>{t('staffing.noneAssigned')}</div>
          )}
          {shift.assigned.map(a => (
            <div key={a.scheduleId} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{a.candidate || '—'}</span>
                {a.status && a.status !== 'scheduled' && (
                  <span
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- soft-tint status pill (§4 chip convention), not a Caption/label copy
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: tintBg('var(--text-muted)'), color: 'var(--text-muted)' }}>
                    {a.status}
                  </span>
                )}
                {a.status !== 'cancelled' && a.status !== 'no_show' && a.status !== 'completed' && (
                  <>
                    <Button variant="secondary" iconOnly size="sm" onClick={() => startCheckout(a.scheduleId)} title={t('staffing.checkout')} aria-label={t('staffing.checkout')}><LogOut size={13} /></Button>
                    <Button variant="secondary" iconOnly size="sm" onClick={() => startCancel(a.scheduleId)} title={t('staffing.cancel')} aria-label={t('staffing.cancel')}><Ban size={13} /></Button>
                    <Button variant="secondary" iconOnly size="sm" onClick={() => handleUnassign(a.scheduleId)} title={t('staffing.unassign')} aria-label={t('staffing.unassign')}
                      disabled={unassign.isPending}><UserMinus size={13} /></Button>
                  </>
                )}
              </div>

              {/* Inline cancel-with-reason form — reason is the real tenant lookup, searchable, never hardcoded. */}
              {cancelling === a.scheduleId && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <CreatableSelect allowCreate={false} value={cancelReason || null} onChange={setCancelReason}
                      placeholder={reasonsLoading ? t('common:loading') : t('staffing.cancelReasonPlaceholder')}
                      options={reasons} />
                  </div>
                  <Button variant="primary" onClick={() => submitCancel(a.scheduleId)} disabled={!cancelReason || cancel.isPending}>
                    <Check size={13} /> {t('staffing.confirmCancel')}
                  </Button>
                  <Button variant="secondary" onClick={() => setCancelling(null)}>{t('common:cancel')}</Button>
                </div>
              )}

              {/* Inline checkout form — actual times only; the hours shown below come
                  straight from the server response, never computed here (§ house rule). */}
              {checkingOut === a.scheduleId && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <Caption as="label">
                    {t('staffing.actualStart')}
                    <input type="datetime-local" style={{ ...INPUT, marginTop: 3 }}
                      value={actualStart.slice(0, 16)} onChange={e => setActualStart(e.target.value)} />
                  </Caption>
                  <Caption as="label">
                    {t('staffing.actualEnd')}
                    <input type="datetime-local" style={{ ...INPUT, marginTop: 3 }}
                      value={actualEnd.slice(0, 16)} onChange={e => setActualEnd(e.target.value)} />
                  </Caption>
                  <Caption as="label" style={{ width: 90 }}>
                    {t('staffing.actualBreak')}
                    <input type="number" min={0} style={{ ...INPUT, marginTop: 3 }}
                      value={actualBreak} onChange={e => setActualBreak(e.target.value)} />
                  </Caption>
                  <Button variant="primary" onClick={() => submitCheckout(a.scheduleId)} disabled={!actualStart || !actualEnd || checkout.isPending}>
                    <Check size={13} /> {t('staffing.confirmCheckout')}
                  </Button>
                  <Button variant="secondary" onClick={() => setCheckingOut(null)}>{t('common:cancel')}</Button>
                </div>
              )}

              {/* Server-computed total after checkout — never a client-side recompute. */}
              {lastCheckout?.scheduleId === a.scheduleId && lastCheckout.hours != null && (
                <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 6 }}>
                  {t('staffing.checkoutSaved', { hours: lastCheckout.hours })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Eligible pool — the backend's own ranked list + its own reason text ── */}
      <div>
        <div style={cardHead}>{t('staffing.eligible')}</div>
        <div style={cardBox}>
          {eligibleLoading && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('common:loading')}</div>}
          {!eligibleLoading && eligibleError && <div style={{ fontSize: 12, color: 'var(--color-danger)', padding: '8px 0' }}>{t('common:errorGeneric')}</div>}
          {!eligibleLoading && !eligibleError && eligible.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>{t('staffing.noneEligible')}</div>
          )}
          {!eligibleLoading && !eligibleError && eligible.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              {c.favourite && <Star size={13} style={{ color: 'var(--color-warning)', flexShrink: 0 }} fill="var(--color-warning)" aria-label={t('staffing.favourite')} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{c.firstName} {c.lastName}</div>
                {c.reason && <Caption as="div">{c.reason}</Caption>}
              </div>
              <Button variant="primary" onClick={() => handleAssign(c.id)} disabled={assign.isPending}>
                {t('staffing.assign')}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </FloatingPanel>
  )
}
