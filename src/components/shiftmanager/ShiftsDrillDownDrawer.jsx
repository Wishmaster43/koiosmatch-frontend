/**
 * ShiftsDrillDownDrawer — slide-in panel that lists the individual shifts behind
 * a chart/KPI data point. Fetches the underlying shifts and shows them with a
 * status badge, searchable. STATUS_META maps a shift status to its label + colors.
 */
import { X, Search, Clock, MapPin, Briefcase, User, Hash, Building2, CalendarCheck, Timer } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../../lib/api'

// Maps a shift status code → display label + badge colors.
const STATUS_META = {
  in_process:         { label: 'Prognose',          bg: '#EFF6FF', color: '#2563EB' },
  completed:          { label: 'Werkelijk',          bg: '#F0FDF4', color: '#16A34A' },
  open:               { label: 'Geen kandidaat',     bg: '#FFF7ED', color: '#C2410C' },
  verwijderd:         { label: 'Niet ingevuld',      bg: '#FEF2F2', color: '#DC2626' },
  niet_factureerbaar: { label: 'Niet factureerbaar', bg: '#F9FAFB', color: '#6B7280' },
}

function Badge({ status }) {
  const s = STATUS_META[status] ?? { label: status ?? 'onbekend', bg: '#F9FAFB', color: '#6B7280' }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999,
                   padding: '2px 8px', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
      {s.label}
    </span>
  )
}

function Row({ icon: Icon, label, value, mono }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
      <Icon size={12} color="#D1D5DB" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ color: '#9CA3AF', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#374151', fontFamily: mono ? 'monospace' : undefined,
                     fontSize: mono ? 11 : 12, wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )
}

function formatDateTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatTime(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CandidateBlock({ invite }) {
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
        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
          {name || 'Onbekend'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 31 }}>
        {c?.email    && <Row icon={User}         label="E-mail"        value={c.email} />}
        {c?.mobile   && <Row icon={User}         label="Mobiel"        value={c.mobile} />}
        {invite.scheduled_at     && <Row icon={CalendarCheck} label="Ingepland"     value={formatDateTime(invite.scheduled_at)} />}
        {invite.total_time_worked && <Row icon={Timer}        label="Gewerkte uren" value={`${invite.total_time_worked} uur`} />}
        {invite.contract_type    && <Row icon={Hash}          label="Contract"      value={invite.contract_type} />}
      </div>
    </div>
  )
}

export default function ShiftsDrillDownDrawer({ title, fetchUrl, onClose }) {
  const [search,  setSearch]  = useState('')
  const [shifts,  setShifts]  = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

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
      .catch(() => active && setError('Kon diensten niet laden.'))
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

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 620, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{title}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {loading ? 'Laden…' : `${shifts.length} diensten`}
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                     borderRadius: 6, marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </button>
        </div>

        {/* Zoekbalk */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: '1px solid #F9FAFB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                        background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 7 }}>
            <Search size={13} color="#9CA3AF" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op functie, locatie, order-ref, kandidaat…"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                       fontSize: 12, color: '#374151' }} />
          </div>
        </div>

        {/* Lijst */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: '#9CA3AF' }}>Laden…</div>
          )}
          {error && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: '#EF4444' }}>{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: '#9CA3AF' }}>Geen diensten gevonden</div>
          )}

          {!loading && !error && filtered.map((shift, i) => {
            const loc     = shift.order?.customer_location
            const planned = ['in_process', 'completed'].includes(shift.own_status)
            const invites = shift.invites ?? []
            const start   = formatTime(shift.start_time)
            const end     = formatTime(shift.end_time)
            const date    = formatDate(shift.start_time)

            return (
              <div key={shift.id ?? i}
                style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {/* Regel 1: functie + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Briefcase size={13} color="#9CA3AF" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>
                    {shift.job_type ?? 'Onbekend'}
                  </span>
                  <Badge status={shift.own_status} />
                </div>

                {/* Details grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 21 }}>

                  {/* Datum & tijd */}
                  <Row icon={Clock} label="Datum"
                    value={date ? `${date}  ${start ?? ''}${end ? ` – ${end}` : ''}` : null} />

                  {/* Personen */}
                  {shift.number_persons > 1 &&
                    <Row icon={User} label="Personen" value={`${shift.number_persons}×`} />}

                  {/* Klant */}
                  {loc?.customer_external_id &&
                    <Row icon={Building2} label="Klant-ID" value={loc.customer_external_id} mono />}

                  {/* Locatie */}
                  {loc?.name &&
                    <Row icon={MapPin} label="Locatie" value={loc.name} />}

                  {/* Adres */}
                  {shift.order?.location_place &&
                    <Row icon={MapPin} label="Plaats"
                      value={[shift.order.location_street, shift.order.location_postal_code,
                              shift.order.location_place].filter(Boolean).join(', ')} />}

                  {/* Order-info */}
                  {shift.order?.order_ref  && <Row icon={Hash} label="Order-ref"  value={shift.order.order_ref} />}
                  {shift.order?.subject    && <Row icon={Hash} label="Onderwerp"  value={shift.order.subject} />}

                  {/* IDs */}
                  {shift.external_id       && <Row icon={Hash} label="Shift-ID (extern)"  value={shift.external_id} mono />}
                  {shift.order_external_id && <Row icon={Hash} label="Order-ID (extern)"  value={shift.order_external_id} mono />}

                  {/* Tarief */}
                  {shift.customer_rate &&
                    <Row icon={Timer} label="Tarief" value={`€ ${shift.customer_rate}`} />}

                  {/* Ophaallocatie */}
                  {shift.pickup_place &&
                    <Row icon={MapPin} label="Ophaal" value={shift.pickup_place} />}
                </div>

                {/* Kandidaten — alleen bij prognose / werkelijk */}
                {planned && (
                  <div style={{ marginTop: 8, paddingLeft: 21 }}>
                    {invites.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
                        Nog geen kandidaat gekoppeld
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
                      padding: '8px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA',
                      flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            {loading ? '…' : `${filtered.length} van ${shifts.length} getoond`}
          </span>
          <button onClick={onClose}
            style={{ fontSize: 12, borderRadius: 6, padding: '4px 12px',
                     background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#6B7280' }}>
            Sluiten
          </button>
        </div>
      </div>
    </>
  )
}
