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
import { BTN_H } from '@/config/buttonMetrics'
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
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)', color: 'var(--text-muted)' }}>
                    {a.status}
                  </span>
                )}
                {a.status !== 'cancelled' && a.status !== 'no_show' && a.status !== 'completed' && (
                  <>
                    <button onClick={() => startCheckout(a.scheduleId)} title={t('staffing.checkout')}
                      style={{ ...iconBtn }}><LogOut size={13} /></button>
                    <button onClick={() => startCancel(a.scheduleId)} title={t('staffing.cancel')}
                      style={{ ...iconBtn }}><Ban size={13} /></button>
                    <button onClick={() => handleUnassign(a.scheduleId)} title={t('staffing.unassign')}
                      disabled={unassign.isPending}
                      style={{ ...iconBtn }}><UserMinus size={13} /></button>
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
                  <button onClick={() => submitCancel(a.scheduleId)} disabled={!cancelReason || cancel.isPending}
                    style={{ ...primaryBtn, opacity: (!cancelReason || cancel.isPending) ? 0.6 : 1 }}>
                    <Check size={13} /> {t('staffing.confirmCancel')}
                  </button>
                  <button onClick={() => setCancelling(null)} style={ghostBtn}>{t('common:cancel')}</button>
                </div>
              )}

              {/* Inline checkout form — actual times only; the hours shown below come
                  straight from the server response, never computed here (§ house rule). */}
              {checkingOut === a.scheduleId && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {t('staffing.actualStart')}
                    <input type="datetime-local" style={{ ...INPUT, marginTop: 3 }}
                      value={actualStart.slice(0, 16)} onChange={e => setActualStart(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {t('staffing.actualEnd')}
                    <input type="datetime-local" style={{ ...INPUT, marginTop: 3 }}
                      value={actualEnd.slice(0, 16)} onChange={e => setActualEnd(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', width: 90 }}>
                    {t('staffing.actualBreak')}
                    <input type="number" min={0} style={{ ...INPUT, marginTop: 3 }}
                      value={actualBreak} onChange={e => setActualBreak(e.target.value)} />
                  </label>
                  <button onClick={() => submitCheckout(a.scheduleId)} disabled={!actualStart || !actualEnd || checkout.isPending}
                    style={{ ...primaryBtn, opacity: (!actualStart || !actualEnd || checkout.isPending) ? 0.6 : 1 }}>
                    <Check size={13} /> {t('staffing.confirmCheckout')}
                  </button>
                  <button onClick={() => setCheckingOut(null)} style={ghostBtn}>{t('common:cancel')}</button>
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
                {c.reason && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.reason}</div>}
              </div>
              <button onClick={() => handleAssign(c.id)} disabled={assign.isPending} style={primaryBtn}>
                {t('staffing.assign')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </FloatingPanel>
  )
}

const iconBtn = { display: 'flex', width: 26, height: 26, alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' } as const
const primaryBtn = { display: 'flex', alignItems: 'center', gap: 4, height: BTN_H, padding: '0 12px', fontSize: 12, fontWeight: 600,
  border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'var(--color-on-accent)', cursor: 'pointer' } as const
const ghostBtn = { height: BTN_H, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' } as const
