import { X, Search, TrendingUp, Target, Info } from 'lucide-react'
import { useState } from 'react'
import { useKpiSettings } from '../../lib/useKpiSettings'

const MONTHS_NL = ['Januari','Februari','Maart','April','Mei','Juni',
                   'Juli','Augustus','September','Oktober','November','December']

function StatusBadge({ status }) {
  const styles = {
    actief:     { bg: '#F0FDF4', color: '#16A34A' },
    nietactief: { bg: '#FFF7ED', color: '#C2410C' },
    extern:     { bg: '#EFF6FF', color: '#1D4ED8' },
    intake:     { bg: '#FAF5FF', color: '#7C3AED' },
    verwijderd: { bg: '#FEF2F2', color: '#DC2626' },
  }
  const key = (status || '').toLowerCase()
  const s   = styles[key] || { bg: '#F9FAFB', color: '#6B7280' }
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999,
                   padding: '2px 8px', fontSize: 11, fontWeight: 500 }}>
      {status || 'onbekend'}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Kandidatenlijst (Nieuw / Uitgeschreven) ───────────────────────────────────

function CandidateList({ candidates, dateField, dateLabel }) {
  const [search, setSearch] = useState('')

  const filtered = candidates.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${c.firstname ?? ''} ${c.lastname ?? ''}`.toLowerCase().includes(q) ||
           (c.position ?? '').toLowerCase().includes(q) ||
           (c.email    ?? '').toLowerCase().includes(q)
  })

  return (
    <>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid #F9FAFB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                      background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 7 }}>
          <Search size={13} color="#9CA3AF" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op naam, functie of e-mail…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12 }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 100, fontSize: 13, color: '#9CA3AF' }}>
            Geen kandidaten gevonden
          </div>
        )}
        {filtered.map((c, i) => {
          const name    = `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || 'Onbekend'
          const initials = `${c.firstname?.[0] ?? ''}${c.lastname?.[0] ?? ''}`.toUpperCase()
          return (
            <div key={c.id ?? i}
              style={{ padding: '10px 16px', borderBottom: '1px solid #F9FAFB',
                       display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 600 }}>
                {initials || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 500, fontSize: 13, color: '#111827' }}>{name}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {c.position && <span>{c.position}</span>}
                  {c.position && c[dateField] && <span> · </span>}
                  {c[dateField] && <span>{dateLabel}: {formatDate(c[dateField])}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '8px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{filtered.length} van {candidates.length} getoond</span>
      </div>
    </>
  )
}

// ── Gemiddelde-uitleg ─────────────────────────────────────────────────────────

function AverageBreakdown({ candidates, KPI_TARGET }) {
  const now          = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()

  // Bouw per-maand tabel voor huidig jaar
  const perMonth = Array.from({ length: 12 }, (_, i) => {
    const count = candidates.filter(c => {
      if (!c.registration_date) return false
      const d = new Date(c.registration_date)
      return d.getFullYear() === currentYear && d.getMonth() === i
    }).length
    return { month: i, label: MONTHS_NL[i], count, isCurrent: i === currentMonth }
  })

  // Gemiddelde: alle maanden met data (excl. toekomstige maanden zonder data)
  const monthsWithData = perMonth.filter(m => m.month <= currentMonth)
  const totalNew       = monthsWithData.reduce((s, m) => s + m.count, 0)
  const avg            = monthsWithData.length
    ? Math.round(totalNew / monthsWithData.length)
    : 0

  const maxCount = Math.max(...perMonth.map(m => m.count), KPI_TARGET, 1)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

      {/* Uitleg formule */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 8,
                    background: '#F0F7FF', border: '1px solid #BFDBFE', marginBottom: 16 }}>
        <Info size={14} color="#2563EB" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#1D4ED8', lineHeight: 1.5 }}>
          <strong>Berekening:</strong> totaal nieuwe kandidaten in {currentYear} tot en met {MONTHS_NL[currentMonth].toLowerCase()}
          ({totalNew}) gedeeld door het aantal maanden ({monthsWithData.length}) = <strong>{avg}/maand</strong>.
          <br />KPI doel is <strong>{KPI_TARGET} per maand</strong>.
        </div>
      </div>

      {/* Samenvatting KPI blokken */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Nieuw deze maand', value: perMonth[currentMonth].count,
            color: perMonth[currentMonth].count >= KPI_TARGET ? '#16A34A' : perMonth[currentMonth].count >= avg ? '#D97706' : '#DC2626' },
          { label: 'Gemiddelde /mnd',  value: avg,   color: '#374151' },
          { label: 'KPI doel /mnd',    value: KPI_TARGET, color: '#6366F1' },
        ].map(b => (
          <div key={b.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: 8,
                                      background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: b.color, letterSpacing: '-0.5px' }}>
              {b.value}
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{b.label}</div>
          </div>
        ))}
      </div>

      {/* Maand-voor-maand tabel */}
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                    letterSpacing: '0.05em', marginBottom: 8 }}>
        Per maand — {currentYear}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {perMonth.filter(m => m.month <= currentMonth).map(m => {
          const pct    = Math.round((m.count / maxCount) * 100)
          const atKpi  = m.count >= KPI_TARGET
          const barColor = atKpi ? '#16A34A' : m.count >= avg ? '#D97706' : '#EF4444'
          return (
            <div key={m.month} style={{
              padding: '7px 10px', borderRadius: 7,
              background: m.isCurrent ? '#F0F9FF' : '#FAFAFA',
              border: `1px solid ${m.isCurrent ? '#BAE6FD' : '#F3F4F6'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 70, fontSize: 12, color: m.isCurrent ? '#0369A1' : '#374151',
                                fontWeight: m.isCurrent ? 600 : 400 }}>
                  {m.label.slice(0, 3)}
                  {m.isCurrent && <span style={{ fontSize: 10, marginLeft: 4, color: '#0369A1' }}>▶</span>}
                </span>
                <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor,
                                borderRadius: 999, transition: 'width 0.3s' }} />
                </div>
                <span style={{ width: 24, textAlign: 'right', fontSize: 12,
                               fontWeight: 600, color: barColor }}>
                  {m.count}
                </span>
                {/* KPI indicator */}
                <span style={{ width: 40, textAlign: 'right', fontSize: 10,
                               color: atKpi ? '#16A34A' : '#9CA3AF' }}>
                  {atKpi ? '✓ KPI' : `${m.count}/${KPI_TARGET}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* KPI streep toelichting */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, color: '#9CA3AF' }}>
        <Target size={11} color="#6366F1" />
        KPI doel: {KPI_TARGET} nieuwe kandidaten per maand
      </div>
    </div>
  )
}

// ── Hoofd-component ───────────────────────────────────────────────────────────

export default function KpiDrillDownDrawer({ mode, title, candidates = [], onClose }) {
  const { new_candidates_target: KPI_TARGET } = useKpiSettings()
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 520, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{title}</div>
            {mode !== 'average' && (
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                {candidates.length} kandidaten
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {mode !== 'average' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                            borderRadius: 6, background: '#F0F7FF', border: '1px solid #BFDBFE' }}>
                <TrendingUp size={11} color="#2563EB" />
                <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 500 }}>
                  KPI: {KPI_TARGET}/mnd
                </span>
              </div>
            )}
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Inhoud */}
        {mode === 'average' ? (
          <AverageBreakdown candidates={candidates} KPI_TARGET={KPI_TARGET} />
        ) : (
          <CandidateList
            candidates={candidates}
            dateField={mode === 'uitgeschreven' ? 'end_date_employment' : 'registration_date'}
            dateLabel={mode === 'uitgeschreven' ? 'Uitgeschreven' : 'Geregistreerd'}
          />
        )}
      </div>
    </>
  )
}
