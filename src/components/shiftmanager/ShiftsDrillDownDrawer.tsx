/**
 * ShiftsDrillDownDrawer — slide-in panel that lists the individual shifts behind
 * a chart/KPI data point. Fetches the underlying shifts and shows them with a
 * status badge, searchable. STATUS_META maps a shift status to its label + colors.
 */
import { X, Search, Clock, MapPin, Briefcase, User, Hash, Building2, CalendarCheck, Timer, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { PageTitle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useDrillDownShifts } from './hooks/useDrillDownShifts'
import DrillTabs from '@/components/ui/DrillTabs'
import ShiftsDrillDownTotals from './ShiftsDrillDownTotals'
import type { LocationMeta } from './ShiftsDrillDownTotals'
import type { ShiftInvite } from '@/types/shiftmanager'
import CopyIconButton from '@/components/ui/CopyIconButton'

// Stable empty location-meta fallback (keeps a constant ref for the totals useMemo).
const EMPTY_META: LocationMeta = new Map()

// Shift status → badge colours. Label = t('shiftsDrawer.status.<key>').
const STATUS_META: Record<string, { bg: string; color: string }> = {
  in_process:         { bg: 'var(--color-secondary-bg)', color: 'var(--color-secondary)' },
  completed:          { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)' },
  // eslint-disable-next-line no-restricted-syntax -- DATA: fixed status→colour mapping, mirrors the lookup-colour pattern used elsewhere; no exact token equivalent for this shade
  open:               { bg: 'var(--color-warning-bg)', color: '#C2410C' },
  // Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its
  // own pastel, AA fail (Opus r3.5).
  verwijderd:         { bg: 'var(--color-danger-bg)', color: 'var(--color-on-danger-bg)' },
  niet_factureerbaar: { bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
}

// Renders a shift's status as a soft-tinted pill, falling back to a neutral
// "unknown" look for a status not covered by STATUS_META.
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

// One labeled detail line with a leading icon; renders nothing for an empty value
// so a shift missing a field doesn't leave a dangling "Label: —" row.
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

// Renders the assigned candidate on a shift row; tolerates the different name-field
// shapes seen on the shift-mirror data and falls back to the email local-part.
function CandidateBlock({ invite }: { invite: ShiftInvite }) {
  const { t } = useTranslation('shiftmanager')
  // House DD-MM-YYYY HH:mm formatter (DATUM-1) — never a hardcoded locale/format string.
  const { formatDateTime } = useDateFormat()
  const c   = (invite.candidate ?? {}) as Record<string, unknown>
  // Tolerant name: accept first_name/last_name OR firstname/lastname; fall back to the
  // email local-part so a nameless mirror row no longer reads "Onbekend".
  const first = String(c.first_name ?? c.firstname ?? '')
  const last  = String(c.last_name  ?? c.lastname  ?? '')
  const email = typeof c.email === 'string' ? c.email : ''
  const name  = `${first} ${last}`.trim() || (email ? email.split('@')[0] : '') || null
  const ini   = (first[0] ?? last[0] ?? email[0] ?? '?').toUpperCase()

  return (
    <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6,
                  background: 'var(--color-primary-bg)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 600 }}>
          {ini}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {name || t('shiftsDrawer.unknown')}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 31 }}>
        {email       && <Row icon={User}         label={t('shiftsDrawer.fields.email')}       value={email} />}
        {typeof c.mobile === 'string' && c.mobile && <Row icon={User} label={t('shiftsDrawer.fields.mobile')} value={c.mobile} />}
        {invite.scheduled_at     && <Row icon={CalendarCheck} label={t('shiftsDrawer.fields.scheduled')}   value={formatDateTime(invite.scheduled_at)} />}
        {invite.total_time_worked && <Row icon={Timer}        label={t('shiftsDrawer.fields.workedHours')} value={t('shiftsDrawer.hoursUnit', { n: invite.total_time_worked })} />}
        {invite.contract_type    && <Row icon={Hash}          label={t('shiftsDrawer.fields.contract')}    value={invite.contract_type} />}
      </div>
    </div>
  )
}

// The slide-in panel itself: series/period picker over totals or a searchable detail
export default function ShiftsDrillDownDrawer({ metric, metricOptions, periods, initialPeriod, buildUrl, titleFor, countFor, onClose, locationMeta }: {
  metric: string                                              // initial series (totaal / geen_kandidaat / …)
  metricOptions: { value: string; label: string }[]           // switchable series (chips)
  periods: { key: string; label: string }[]                   // selectable periods (months) to page through
  initialPeriod: string                                       // the clicked period
  buildUrl: (metric: string, period: string) => string        // detail URL for a series + period
  titleFor: (metric: string, period: string) => string        // drawer title
  countFor: (metric: string, period: string) => number        // chip badge (from the already-loaded chartData)
  onClose: () => void
  // Location id → { name, customer } so the totals view can show real customer names.
  locationMeta?: LocationMeta
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('shiftmanager')
  // House DD-MM-YYYY / HH:mm formatters (DATUM-1) — never a hardcoded locale/format string.
  const { formatDate, formatTime } = useDateFormat()
  const [search, setSearch] = useState('')
  // Default to grouped totals (Danny: "geen orderlijsten maar totalen"); Details stays reachable.
  const [view, setView] = useState<'totals' | 'details'>('totals')
  // Series switcher (chips) + month pager (‹ aug › / ← →) — the standard for every drill.
  const [currentMetric, setCurrentMetric] = useState(metric)
  const [currentPeriod, setCurrentPeriod] = useState(initialPeriod)
  const title = titleFor(currentMetric, currentPeriod)
  const { shifts, loading, error } = useDrillDownShifts(buildUrl(currentMetric, currentPeriod))
  const periodIdx = periods.findIndex(p => p.key === currentPeriod)
  const goPeriod = (delta: number) => { const i = periodIdx + delta; if (i >= 0 && i < periods.length) setCurrentPeriod(periods[i].key) }
  const metricTabs = metricOptions.map(o => ({ key: o.value, label: o.label, count: countFor(o.value, currentPeriod) }))

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

  // Small pager button (prev/next period) — house Button, iconOnly/secondary.
  // `dir` only selects the icon/translated label; it is never rendered raw.
  const pagerBtn = (dir: 'prev' | 'next', onClick: () => void, disabled: boolean) => (
    <Button type="button" variant="secondary" iconOnly onClick={onClick} disabled={disabled}
      aria-label={dir === 'prev' ? t('common:prevPage') : t('common:nextPage')}>
      {dir === 'prev' ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
    </Button>
  )

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex: 'var(--z-drawer)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        onKeyDown={e => { if (e.target instanceof HTMLInputElement) return; if (e.key === 'ArrowLeft') goPeriod(-1); else if (e.key === 'ArrowRight') goPeriod(1) }}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 620, zIndex: 'var(--z-drawer)', boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header: title + month pager + count */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <PageTitle as="div">{title}</PageTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {periods.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {pagerBtn('prev', () => goPeriod(-1), periodIdx <= 0)}
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 42, textAlign: 'center' }}>{periods[periodIdx]?.label}</span>
                  {pagerBtn('next', () => goPeriod(1), periodIdx >= periods.length - 1)}
                </div>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {loading ? t('shiftsDrawer.loading') : t('shiftsDrawer.count', { count: shifts.length })}
              </span>
            </div>
          </div>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')} style={{ marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </Button>
        </div>

        {/* Series chips (the standard switcher) — badge = count in the current period */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: '1px solid var(--hover-bg)' }}>
          <DrillTabs tabs={metricTabs} active={currentMetric} onChange={setCurrentMetric} />
        </div>

        {/* View toggle (Totalen | Details) + search — search only applies to the details list */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: '1px solid var(--hover-bg)',
                      display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* HUISSTIJL-1: the shared DrillTabs atom (already used above for the metric
              series switcher) replaces the hand-rolled two-button toggle pair. */}
          <div style={{ flexShrink: 0 }}>
            <DrillTabs tabs={[
              { key: 'totals', label: t('shiftsDrawer.viewTotals') },
              { key: 'details', label: t('shiftsDrawer.viewDetails') },
            ]} active={view} onChange={v => setView(v as 'totals' | 'details')} />
          </div>
          {view === 'details' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', flex: 1,
                          background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7 }}>
              <Search size={13} color="var(--text-muted)" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('shiftsDrawer.search')} aria-label={t('shiftsDrawer.search')}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                         fontSize: 12, color: 'var(--text)' }} />
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--text-muted)' }}>{t('shiftsDrawer.loading')}</div>
          )}
          {error && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--color-danger-text)' }}>{t('shiftsDrawer.loadError')}</div>
          )}
          {/* Totals view — grouped counts per customer / role / location */}
          {!loading && !error && view === 'totals' && (
            <ShiftsDrillDownTotals shifts={shifts} locationMeta={locationMeta ?? EMPTY_META} />
          )}

          {!loading && !error && view === 'details' && filtered.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--text-muted)' }}>{t('shiftsDrawer.empty')}</div>
          )}

          {!loading && !error && view === 'details' && filtered.map((shift, i) => {
            const loc     = shift.order?.customer_location
            const planned = ['in_process', 'completed'].includes(shift.own_status ?? '')
            const invites = shift.invites ?? []
            const start   = formatTime(shift.start_time)
            const end     = formatTime(shift.end_time)
            const date    = shift.start_time ? formatDate(shift.start_time) : null

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
                      value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {[shift.order?.location_street, shift.order?.location_postal_code,
                          shift.order?.location_place].filter(Boolean).join(', ')}
                        <CopyIconButton value={[shift.order?.location_street, shift.order?.location_postal_code,
                          shift.order?.location_place].filter(Boolean).join(', ')}
                          label={t('common:copyAddress.copy')} copiedLabel={t('common:copyAddress.copied')} />
                      </span>} />}

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
          <Button variant="secondary" onClick={onClose}>
            {t('shiftsDrawer.close')}
          </Button>
        </div>
      </div>
    </>
  )
}
