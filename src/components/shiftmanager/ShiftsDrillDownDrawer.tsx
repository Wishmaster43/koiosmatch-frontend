/**
 * ShiftsDrillDownDrawer — slide-in panel that lists the individual shifts behind
 * a chart/KPI data point. Fetches the underlying shifts and shows them with a
 * status badge, searchable. STATUS_META maps a shift status to its label + colors.
 */
import { X, Search, Clock, MapPin, Briefcase, User, Hash, Building2, CalendarCheck, Timer } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { LucideIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import type { ShiftRow, ShiftInvite } from '@/types/shiftmanager'

// Shift status → badge colours. Label = t('shiftsDrawer.status.<key>').
const STATUS_META: Record<string, { bg: string; color: string }> = {
  in_process:         { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
  completed:          { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  open:               { bg: 'var(--color-warning-bg)', color: '#C2410C' },
  verwijderd:         { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  niet_factureerbaar: { bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
}

function Badge({ status }: { status?: string }) {
  const { t } = useTranslation('shiftmanager')
  const s = STATUS_META[status ?? ''] ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999,
                   padding: '2px 8px', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
      {status ? t(`shiftsDrawer.status.${status}`, { defaultValue: status }) : t('shiftsDrawer.unknown')}
    </span>
  )
}

function Row({ icon: Icon, label, value, mono }: { icon: LucideIcon; label: ReactNode; value?: ReactNode; mono?: boolean }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
      <Icon size={12} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: 'var(--text)', fontFamily: mono ? 'monospace' : undefined,
                     fontSize: mono ? 11 : 12, wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )
}

function formatDateTime(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatTime(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CandidateBlock({ invite }: { invite: ShiftInvite }) {
  const { t } = useTranslation('shiftmanager')
  const c    = invite.candidate
  const name = c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : null
  const ini  = c ? `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase() : '?'

  return (
    <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6,
                  background: '#F8FAFF', border: '1px solid #E0E7FF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 600 }}>
          {ini}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {name || t('shiftsDrawer.unknown')}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 31 }}>
        {c?.email    && <Row icon={User}         label={t('shiftsDrawer.fields.email')}       value={c.email} />}
        {c?.mobile   && <Row icon={User}         label={t('shiftsDrawer.fields.mobile')}      value={c.mobile} />}
        {invite.scheduled_at     && <Row icon={CalendarCheck} label={t('shiftsDrawer.fields.scheduled')}   value={formatDateTime(invite.scheduled_at)} />}
        {invite.total_time_worked && <Row icon={Timer}        label={t('shiftsDrawer.fields.workedHours')} value={t('shiftsDrawer.hoursUnit', { n: invite.total_time_worked })} />}
        {invite.contract_type    && <Row icon={Hash}          label={t('shiftsDrawer.fields.contract')}    value={invite.contract_type} />}
      </div>
    </div>
  )
}

export default function ShiftsDrillDownDrawer({ title, fetchUrl, onClose }: {
  title: ReactNode
  fetchUrl: string
  onClose: () => void
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('shiftmanager')
  const [search,  setSearch]  = useState('')
  const [shifts,  setShifts]  = useState<ShiftRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!fetchUrl) return
    let active = true
    setLoading(true)
    setError(null)
    api.get(fetchUrl)
      .then(res => {
        if (!active) return
        const data = res.data?.data ?? res.data ?? []
        setShifts(Array.isArray(data) ? data : [])
      })
      .catch(() => active && setError(t('shiftsDrawer.loadError')))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [fetchUrl])

  const filtered = shifts.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (s.job_type                          ?? '').toLowerCase().includes(q) ||
      (s.order?.order_ref                  ?? '').toLowerCase().includes(q) ||
      (s.external_id                       ?? '').toLowerCase().includes(q) ||
      (s.order?.customer_location?.name    ?? '').toLowerCase().includes(q) ||
      (s.invites ?? []).some(inv =>
        `${inv.candidate?.first_name ?? ''} ${inv.candidate?.last_name ?? ''}`.toLowerCase().includes(q)
      )
    )
  })

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 620, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {loading ? t('shiftsDrawer.loading') : t('shiftsDrawer.count', { count: shifts.length })}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                     borderRadius: 6, marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </button>
        </div>

        {/* Search bar */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: '1px solid var(--hover-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                        background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('shiftsDrawer.search')} aria-label={t('shiftsDrawer.search')}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                       fontSize: 12, color: 'var(--text)' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--text-muted)' }}>{t('shiftsDrawer.loading')}</div>
          )}
          {error && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--color-danger)' }}>{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--text-muted)' }}>{t('shiftsDrawer.empty')}</div>
          )}

          {!loading && !error && filtered.map((shift, i) => {
            const loc     = shift.order?.customer_location
            const planned = ['in_process', 'completed'].includes(shift.own_status ?? '')
            const invites = shift.invites ?? []
            const start   = formatTime(shift.start_time)
            const end     = formatTime(shift.end_time)
            const date    = formatDate(shift.start_time)

            return (
              <div key={shift.id ?? i}
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {/* Row 1: position + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Briefcase size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', flex: 1 }}>
                    {shift.job_type ?? t('shiftsDrawer.unknown')}
                  </span>
                  <Badge status={shift.own_status} />
                </div>

                {/* Details grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 21 }}>

                  {/* Date & time */}
                  <Row icon={Clock} label={t('shiftsDrawer.fields.date')}
                    value={date ? `${date}  ${start ?? ''}${end ? ` – ${end}` : ''}` : null} />

                  {/* People */}
                  {(shift.number_persons ?? 0) > 1 &&
                    <Row icon={User} label={t('shiftsDrawer.fields.persons')} value={`${shift.number_persons}×`} />}

                  {/* Customer */}
                  {loc?.customer_external_id &&
                    <Row icon={Building2} label={t('shiftsDrawer.fields.customerId')} value={loc.customer_external_id} mono />}

                  {/* Location */}
                  {loc?.name &&
                    <Row icon={MapPin} label={t('shiftsDrawer.fields.location')} value={loc.name} />}

                  {/* Address */}
                  {shift.order?.location_place &&
                    <Row icon={MapPin} label={t('shiftsDrawer.fields.place')}
                      value={[shift.order?.location_street, shift.order?.location_postal_code,
                              shift.order?.location_place].filter(Boolean).join(', ')} />}

                  {/* Order info */}
                  {shift.order?.order_ref  && <Row icon={Hash} label={t('shiftsDrawer.fields.orderRef')}  value={shift.order?.order_ref} />}
                  {shift.order?.subject    && <Row icon={Hash} label={t('shiftsDrawer.fields.subject')}   value={shift.order?.subject} />}

                  {/* IDs */}
                  {shift.external_id       && <Row icon={Hash} label={t('shiftsDrawer.fields.shiftIdExt')}  value={shift.external_id} mono />}
                  {shift.order_external_id && <Row icon={Hash} label={t('shiftsDrawer.fields.orderIdExt')}  value={shift.order_external_id} mono />}

                  {/* Rate */}
                  {shift.customer_rate &&
                    <Row icon={Timer} label={t('shiftsDrawer.fields.rate')} value={`€ ${shift.customer_rate}`} />}

                  {/* Pickup location */}
                  {shift.pickup_place &&
                    <Row icon={MapPin} label={t('shiftsDrawer.fields.pickup')} value={shift.pickup_place} />}
                </div>

                {/* Candidates — only for forecast / actual */}
                {planned && (
                  <div style={{ marginTop: 8, paddingLeft: 21 }}>
                    {invites.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {t('shiftsDrawer.noCandidate')}
                      </div>
                    ) : (
                      invites.map((inv, j) => <CandidateBlock key={inv.id ?? j} invite={inv} />)
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--hover-bg)',
                      flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {loading ? '…' : t('shiftsDrawer.shownOf', { shown: filtered.length, total: shifts.length })}
          </span>
          <button onClick={onClose}
            style={{ fontSize: 12, borderRadius: 6, padding: '4px 12px',
                     background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {t('shiftsDrawer.close')}
          </button>
        </div>
      </div>
    </>
  )
}
