import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, User, Save, Star, Search } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
const DAYS_NL   = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MONTHS_NL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDate(d) {
  return `${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`
}

// ── Dummy shifts ──────────────────────────────────────────────────────────────
const today = new Date()
const y = today.getFullYear(), m = today.getMonth()

const INITIAL_SHIFTS = [
  { id: 1, date: new Date(y, m, today.getDate()),     title: 'Nachtdienst', location: 'Rivas Zorggroep',   candidate: 'Ismail Eddahchouri', start: '22:00', end: '06:00', color: '#6366F1' },
  { id: 2, date: new Date(y, m, today.getDate()),     title: 'Dagdienst',   location: 'Yesway Zorg',       candidate: 'Elif Akagündüz',     start: '07:00', end: '15:00', color: '#22C55E' },
  { id: 3, date: new Date(y, m, today.getDate() + 1), title: 'Avonddienst', location: 'WoonzorgGroep',     candidate: 'Rubina Milan',        start: '15:00', end: '23:00', color: '#F59E0B' },
  { id: 4, date: new Date(y, m, today.getDate() + 2), title: 'Dagdienst',   location: 'Rivas Zorggroep',   candidate: 'Merel Van Muijlwijk', start: '07:00', end: '15:00', color: '#22C55E' },
  { id: 5, date: new Date(y, m, today.getDate() + 4), title: 'Nachtdienst', location: 'Yesway Zorg',       candidate: 'Figen Ooijevaar',     start: '22:00', end: '06:00', color: '#6366F1' },
  { id: 6, date: new Date(y, m, today.getDate() - 1), title: 'Dagdienst',   location: 'WoonzorgGroep',     candidate: 'Petra Kuiters',       start: '07:00', end: '15:00', color: '#22C55E' },
]

// ── Dummy kandidaten voor suggesties ─────────────────────────────────────────
const SUGGESTIES = [
  { name: 'Ismail Eddahchouri',   initials: 'IE', functie: 'Verzorgende IG',   uren: 8,   km: '3.2km',  color: '#6366F1', favoriet: true  },
  { name: 'Merel Van Muijlwijk',  initials: 'MV', functie: 'Helpende',         uren: 24,  km: '7.1km',  color: '#22C55E', favoriet: true  },
  { name: 'Elif Akagündüz',       initials: 'EA', functie: 'Gastvrouw',         uren: 16,  km: '5.4km',  color: '#F59E0B', favoriet: false },
  { name: 'Rubina Rosella Milan', initials: 'RM', functie: 'Verzorgende',       uren: 32,  km: '9.8km',  color: '#3B82F6', favoriet: false },
  { name: 'Figen Ooijevaar',      initials: 'FO', functie: 'Zorgmedewerker',   uren: 12,  km: '11.2km', color: '#8B5CF6', favoriet: false },
  { name: 'Petra Kuiters',        initials: 'PK', functie: 'Helpende',         uren: 40,  km: '18.5km', color: '#EC4899', favoriet: false },
]

// ── Field helpers ─────────────────────────────────────────────────────────────
const INPUT = { padding: '7px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7,
  outline: 'none', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const LABEL = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const SELECT = { ...INPUT, appearance: 'none', cursor: 'pointer' }

function Field({ label, children }) {
  return <div style={{ marginBottom: 10 }}><label style={LABEL}>{label}</label>{children}</div>
}

function SectionHead({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
      textTransform: 'uppercase', padding: '8px 0 4px', borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
      {children}
    </div>
  )
}

function Avatar({ initials, size = 26 }) {
  const colors = ['#6366F1','#3B82F6','#22C55E','#F59E0B','#EF4444','#8B5CF6','#EC4899']
  const color  = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontSize: size * 0.36, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

// ── Add Shift Modal ───────────────────────────────────────────────────────────
function AddShiftModal({ date, onClose, onAdd }) {
  const [title,      setTitle]      = useState('Dagdienst')
  const [start,      setStart]      = useState('07:00')
  const [end,        setEnd]        = useState('15:00')
  const [jobtype,    setJobtype]    = useState('Verzorgende IG')
  const [klant,      setKlant]      = useState('Stichting Rivas Zorggroep')
  const [afdeling,   setAfdeling]   = useState('Watertorenlocatie')
  const [locatie,    setLocatie]    = useState('Boezemlaan 4, 2771 VP Boskoop')
  const [personen,   setPersonen]   = useState(1)
  const [kandidaat,  setKandidaat]  = useState(null)
  const [zoek,       setZoek]       = useState('')
  const [color,      setColor]      = useState('#22C55E')
  const COLORS = ['#22C55E','#6366F1','#F59E0B','#EF4444','#3B82F6','#8B5CF6']

  const gefilterd = SUGGESTIES.filter(s =>
    s.name.toLowerCase().includes(zoek.toLowerCase()) ||
    s.functie.toLowerCase().includes(zoek.toLowerCase())
  )
  const favorieten = gefilterd.filter(s => s.favoriet)
  const overige    = gefilterd.filter(s => !s.favoriet)

  const handleSave = () => {
    onAdd({ title, location: klant, candidate: kandidaat?.name || '', start, end, color, date })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}
        onClick={e => e.target === e.currentTarget && onClose()}>

        {/* ── Modal wrapper gecentreerd ── */}
        <div style={{ margin: 'auto', width: '92%', maxWidth: 1100, height: '90vh',
          background: 'var(--bg)', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border)' }}>

          {/* Header balk */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px',
            background: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sidebar-text)' }}>Dienst toevoegen</span>
              <span style={{ fontSize: 12, color: 'var(--sidebar-muted)', marginLeft: 10 }}>{formatDate(date)}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={handleSave}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 12,
                  fontWeight: 600, background: 'var(--color-primary)', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                <Save size={13} /> Opslaan
              </button>
              <button onClick={onClose}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, background: 'none', border: '1px solid var(--sidebar-border)',
                  borderRadius: 8, cursor: 'pointer', color: 'var(--sidebar-muted)' }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Body: 3 kolommen */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* ── Links: order info ── */}
            <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
              background: 'var(--surface)', overflowY: 'auto', padding: '14px 14px' }}>
              <SectionHead>Order</SectionHead>
              <Field label="Klant">
                <select style={SELECT} value={klant} onChange={e => setKlant(e.target.value)}>
                  <option>Stichting Rivas Zorggroep</option>
                  <option>Yesway Zorg</option>
                  <option>WoonzorgGroep</option>
                  <option>Stichting Floravita</option>
                </select>
              </Field>
              <Field label="Afdeling">
                <select style={SELECT} value={afdeling} onChange={e => setAfdeling(e.target.value)}>
                  <option>Watertorenlocatie</option>
                  <option>Hoofdkantoor</option>
                  <option>Thuiszorg</option>
                </select>
              </Field>
              <Field label="Opdracht"><input style={INPUT} defaultValue="Watertorenlocatie" /></Field>
              <Field label="Contactpersoon"><input style={INPUT} placeholder="Naam contactpersoon" /></Field>

              <SectionHead>Locatie</SectionHead>
              <Field label="Adres">
                <textarea style={{ ...INPUT, resize: 'none', height: 56 }}
                  value={locatie} onChange={e => setLocatie(e.target.value)} />
              </Field>

              <SectionHead>Kleur</SectionHead>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>

            {/* ── Midden: dienst details ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
              <SectionHead>Dienst 1</SectionHead>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <Field label="Naam dienst">
                  <input style={INPUT} value={title} onChange={e => setTitle(e.target.value)} />
                </Field>
                <Field label="Begintijd">
                  <input type="time" style={INPUT} value={start} onChange={e => setStart(e.target.value)} />
                </Field>
                <Field label="Eindtijd">
                  <input type="time" style={INPUT} value={end} onChange={e => setEnd(e.target.value)} />
                </Field>
                <Field label="Aantal personen">
                  <input type="number" style={INPUT} value={personen} min={1} max={20}
                    onChange={e => setPersonen(Number(e.target.value))} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <Field label="Jobtype">
                  <select style={SELECT} value={jobtype} onChange={e => setJobtype(e.target.value)}>
                    <option>Verzorgende IG</option>
                    <option>Helpende</option>
                    <option>Verpleegkundige</option>
                    <option>Gastvrouw</option>
                    <option>Zorgmedewerker</option>
                  </select>
                </Field>
                <Field label="Open dienst">
                  <select style={SELECT}>
                    <option>Alle medewerkers</option>
                    <option>Favorieten</option>
                    <option>Vaste medewerkers</option>
                  </select>
                </Field>
              </div>

              {/* Ingeplande kandidaat */}
              <SectionHead>Ingeplande medewerker</SectionHead>
              {kandidaat ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  border: `1px solid ${kandidaat.color}40`, borderLeft: `4px solid ${kandidaat.color}`,
                  borderRadius: 8, background: 'var(--surface)', marginBottom: 10 }}>
                  <Avatar initials={kandidaat.initials} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{kandidaat.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{kandidaat.functie} · {kandidaat.uren} uur · {kandidaat.km}</div>
                  </div>
                  <button onClick={() => setKandidaat(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)',
                  borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Klik op een kandidaat uit de lijst →
                </div>
              )}

              {/* Notities */}
              <SectionHead>Notities</SectionHead>
              <textarea style={{ ...INPUT, height: 70, resize: 'none' }} placeholder="Interne notitie bij deze dienst…" />

              {/* Opdracht prestaties */}
              <SectionHead style={{ marginTop: 16 }}>Opdracht prestaties</SectionHead>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Naam','Opdrachtgever','Functie','Collega\'s'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kandidaat ? (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{kandidaat.name}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{klant}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{kandidaat.functie}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>-</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        Nog geen medewerker ingepland
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Rechts: kandidaat suggesties ── */}
            <div style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)',
              background: 'var(--surface)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

              {/* Zoek */}
              <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input value={zoek} onChange={e => setZoek(e.target.value)}
                    placeholder="Zoek kandidaat…"
                    style={{ ...INPUT, paddingLeft: 28, fontSize: 12 }} />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>

                {/* Favorieten */}
                {favorieten.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
                      textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={10} /> Favorieten
                    </div>
                    {favorieten.map(s => (
                      <KandidaatRij key={s.name} s={s} selected={kandidaat?.name === s.name} onClick={() => setKandidaat(s)} />
                    ))}
                    <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
                  </>
                )}

                {/* Suggesties */}
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
                  textTransform: 'uppercase', marginBottom: 6 }}>
                  Suggesties — {jobtype}
                </div>
                {overige.map(s => (
                  <KandidaatRij key={s.name} s={s} selected={kandidaat?.name === s.name} onClick={() => setKandidaat(s)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KandidaatRij({ s, selected, onClick }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8,
        background: selected ? 'var(--color-primary-bg)' : 'transparent',
        border: selected ? `1px solid var(--color-primary)` : '1px solid transparent',
        cursor: 'pointer', marginBottom: 4, transition: 'background 0.1s' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--hover-bg)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}>
      <Avatar initials={s.initials} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.uren} uur · {s.km}</div>
      </div>
      {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
    </div>
  )
}

// ── Shift pill ────────────────────────────────────────────────────────────────
function ShiftPill({ shift, small }) {
  return (
    <div style={{ background: shift.color + '20', borderLeft: `3px solid ${shift.color}`,
      borderRadius: 4, padding: small ? '2px 5px' : '3px 7px', marginBottom: 2,
      cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ fontSize: small ? 10 : 11, fontWeight: 600, color: shift.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {shift.start} {shift.title}
      </div>
      {!small && shift.candidate && (
        <div style={{ fontSize: 10, color: shift.color + 'CC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shift.candidate}
        </div>
      )}
    </div>
  )
}

// ── Month view ────────────────────────────────────────────────────────────────
function MonthView({ current, shifts, today, onDayClick }) {
  const year  = current.getFullYear()
  const month = current.getMonth()
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)

  // Start grid on Monday
  const startDay = (first.getDay() + 6) % 7
  const days = []
  for (let i = 0; i < startDay; i++) {
    const d = new Date(year, month, 1 - (startDay - i))
    days.push({ date: d, outside: true })
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: new Date(year, month, d), outside: false })
  }
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - last.getDate() - startDay + 1)
    days.push({ date: d, outside: true })
  }

  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  const WEEK_DAYS = ['Ma','Di','Wo','Do','Vr','Za','Zo']

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
        {WEEK_DAYS.map(d => (
          <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11,
            fontWeight: 600, color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)',
            borderBottom: '1px solid var(--border)', minHeight: 110 }}>
            {week.map(({ date, outside }, di) => {
              const isToday  = isSameDay(date, today)
              const dayShifts = shifts.filter(s => isSameDay(s.date, date))
              return (
                <div key={di}
                  onClick={() => onDayClick(date)}
                  style={{ borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                    padding: '6px 6px 4px', background: outside ? 'var(--bg)' : 'var(--surface)',
                    cursor: 'pointer', minHeight: 110, position: 'relative' }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = outside ? '#f0f0f0' : 'var(--hover-bg)' }}
                  onMouseLeave={e => e.currentTarget.style.background = outside ? 'var(--bg)' : 'var(--surface)' }>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 4, fontSize: 12, fontWeight: isToday ? 700 : 400,
                    background: isToday ? 'var(--color-primary)' : 'transparent',
                    color: outside ? 'var(--text-muted)' : isToday ? '#fff' : 'var(--text)',
                  }}>
                    {date.getDate()}
                  </div>
                  {dayShifts.slice(0, 3).map(s => <ShiftPill key={s.id} shift={s} small />)}
                  {dayShifts.length > 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 2 }}>+{dayShifts.length - 3} meer</div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────
function WeekView({ current, shifts, today, onDayClick }) {
  const startOfWeek = new Date(current)
  const dow = (current.getDay() + 6) % 7
  startOfWeek.setDate(current.getDate() - dow)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })
  const WEEK_LABELS = ['Ma','Di','Wo','Do','Vr','Za','Zo']

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '2px solid var(--border)' }}>
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today)
          return (
            <div key={i} style={{ borderRight: i < 6 ? '1px solid var(--border)' : 'none', padding: '8px 6px' }}>
              <div style={{ textAlign: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{WEEK_LABELS[i]}</div>
                <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '0 auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--color-primary)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text)', fontSize: 14, fontWeight: isToday ? 700 : 400 }}>
                  {d.getDate()}
                </div>
              </div>
              <div onClick={() => onDayClick(d)} style={{ minHeight: 300, cursor: 'pointer', padding: '2px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {shifts.filter(s => isSameDay(s.date, d)).map(s => (
                  <ShiftPill key={s.id} shift={s} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────
function DayView({ current, shifts, today, onDayClick }) {
  const dayShifts = shifts.filter(s => isSameDay(s.date, current))
  const isToday = isSameDay(current, today)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
      <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          {isToday && <span style={{ color: 'var(--color-primary)', marginRight: 8 }}>Vandaag —</span>}
          {formatDate(current)}
        </div>
      </div>

      {dayShifts.length === 0
        ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Geen diensten gepland</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Klik hieronder om een dienst toe te voegen.</div>
            <button onClick={() => onDayClick(current)}
              style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, background: 'var(--color-primary)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              + Dienst toevoegen
            </button>
          </div>
        )
        : (
          <>
            {dayShifts.map(s => (
              <div key={s.id} style={{ display: 'flex', gap: 14, padding: '14px 16px',
                border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`,
                borderRadius: 10, marginBottom: 10, background: 'var(--surface)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      <Clock size={12} /> {s.start} – {s.end}
                    </span>
                    {s.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <MapPin size={12} /> {s.location}
                      </span>
                    )}
                    {s.candidate && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <User size={12} /> {s.candidate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => onDayClick(current)}
              style={{ width: '100%', padding: '9px', fontSize: 13, border: '1px dashed var(--border)',
                borderRadius: 8, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
              + Dienst toevoegen
            </button>
          </>
        )
      }
    </div>
  )
}

// ── List view ─────────────────────────────────────────────────────────────────
function ListView({ shifts, today, onDayClick }) {
  const sorted = [...shifts].sort((a, b) => a.date - b.date)
  const grouped = {}
  sorted.forEach(s => {
    const key = s.date.toDateString()
    if (!grouped[key]) grouped[key] = { date: s.date, shifts: [] }
    grouped[key].shifts.push(s)
  })

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
      {Object.values(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Geen diensten gepland.
        </div>
      )}
      {Object.values(grouped).map(({ date, shifts: ds }) => {
        const isToday = isSameDay(date, today)
        return (
          <div key={date.toDateString()} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
              borderBottom: '2px solid var(--border)', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700,
                color: isToday ? 'var(--color-primary)' : 'var(--text)' }}>
                {isToday ? 'Vandaag — ' : ''}{formatDate(date)}
              </span>
              <button onClick={() => onDayClick(date)}
                style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px',
                  border: '1px solid var(--border)', borderRadius: 6, background: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer' }}>
                + Toevoegen
              </button>
            </div>
            {ds.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`,
                borderRadius: 8, marginBottom: 6, background: 'var(--surface)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} /> {s.start}–{s.end}
                    </span>
                    {s.location && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{s.location}</span>}
                    {s.candidate && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} />{s.candidate}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Main planning page ────────────────────────────────────────────────────────
const VIEWS = ['Maand', 'Week', 'Dag', 'Lijst']

export default function PlanningPage() {
  const [view,       setView]       = useState('Maand')
  const [current,    setCurrent]    = useState(new Date())
  const [shifts,     setShifts]     = useState(INITIAL_SHIFTS)
  const [modal,      setModal]      = useState(null) // date to add shift for
  const todayDate = useMemo(() => new Date(), [])

  const navigate = (dir) => {
    const d = new Date(current)
    if (view === 'Maand') d.setMonth(d.getMonth() + dir)
    else if (view === 'Week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setCurrent(d)
  }

  const goToday = () => setCurrent(new Date())

  const headerLabel = () => {
    if (view === 'Maand') return `${MONTHS_NL[current.getMonth()]} ${current.getFullYear()}`
    if (view === 'Week') {
      const dow = (current.getDay() + 6) % 7
      const start = new Date(current); start.setDate(current.getDate() - dow)
      const end   = new Date(start);   end.setDate(start.getDate() + 6)
      return `${start.getDate()} ${MONTHS_NL[start.getMonth()]} – ${end.getDate()} ${MONTHS_NL[end.getMonth()]} ${end.getFullYear()}`
    }
    return formatDate(current)
  }

  const handleDayClick = (date) => setModal(date)

  const handleAdd = (data) => {
    setShifts(prev => [...prev, { ...data, id: Date.now() }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
        borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Today */}
        <button onClick={goToday}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)',
            borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          Vandaag
        </button>

        {/* Prev / Next */}
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', padding: 6, border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          <ChevronLeft size={15} />
        </button>
        <button onClick={() => navigate(1)}
          style={{ display: 'flex', padding: 6, border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          <ChevronRight size={15} />
        </button>

        {/* Period label */}
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          {headerLabel()}
        </span>

        {/* View switcher */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: view === v ? 600 : 400,
                border: 'none', borderRight: v !== 'Lijst' ? '1px solid var(--border)' : 'none',
                background: view === v ? 'var(--color-primary)' : 'var(--surface)',
                color:      view === v ? '#fff' : 'var(--text)', cursor: 'pointer' }}>
              {v}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button onClick={() => setModal(new Date())}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12,
            fontWeight: 600, background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} /> Dienst toevoegen
        </button>
      </div>

      {/* ── Calendar body ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'Maand' && <MonthView current={current} shifts={shifts} today={todayDate} onDayClick={handleDayClick} />}
        {view === 'Week'  && <WeekView  current={current} shifts={shifts} today={todayDate} onDayClick={handleDayClick} />}
        {view === 'Dag'   && <DayView   current={current} shifts={shifts} today={todayDate} onDayClick={handleDayClick} />}
        {view === 'Lijst' && <ListView  shifts={shifts} today={todayDate} onDayClick={handleDayClick} />}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <AddShiftModal
          date={modal}
          onClose={() => setModal(null)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
