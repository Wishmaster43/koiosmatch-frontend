/**
 * AddShiftModal — the "plan a shift" dialog: order/location/colour, shift times,
 * candidate suggestions and notes. Self-contained subtree (its Field/SectionHead/
 * Avatar/KandidaatRij helpers + style consts live here). Extracted from PlanningPage.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Save, Star, Search } from 'lucide-react'
import { formatDate } from './helpers'
import { interactive } from '@/lib/a11y'
import type { Suggestie, ShiftInput } from '../../types/planning'

// ── Dummy kandidaten voor suggesties ─────────────────────────────────────────
const SUGGESTIES: Suggestie[] = [
  { name: 'Ismail Eddahchouri',   initials: 'IE', functie: 'Verzorgende IG',   uren: 8,   km: '3.2km',  color: 'var(--color-primary)', favoriet: true  },
  { name: 'Merel Van Muijlwijk',  initials: 'MV', functie: 'Helpende',         uren: 24,  km: '7.1km',  color: 'var(--color-success)', favoriet: true  },
  { name: 'Elif Akagündüz',       initials: 'EA', functie: 'Gastvrouw',         uren: 16,  km: '5.4km',  color: 'var(--color-warning)', favoriet: false },
  { name: 'Rubina Rosella Milan', initials: 'RM', functie: 'Verzorgende',       uren: 32,  km: '9.8km',  color: 'var(--color-secondary)', favoriet: false },
  { name: 'Figen Ooijevaar',      initials: 'FO', functie: 'Zorgmedewerker',   uren: 12,  km: '11.2km', color: '#8B5CF6', favoriet: false },
  { name: 'Petra Kuiters',        initials: 'PK', functie: 'Helpende',         uren: 40,  km: '18.5km', color: '#EC4899', favoriet: false },
]

// ── Field helpers ─────────────────────────────────────────────────────────────
const INPUT: CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7,
  outline: 'none', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const LABEL: CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const SELECT: CSSProperties = { ...INPUT, appearance: 'none', cursor: 'pointer' }

function Field({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return <div style={{ marginBottom: 10 }}><label style={LABEL}>{label}</label>{children}</div>
}

function SectionHead({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
      textTransform: 'uppercase', padding: '8px 0 4px', borderBottom: '1px solid var(--border)', marginBottom: 10, ...style }}>
      {children}
    </div>
  )
}

function Avatar({ initials, size = 26 }: { initials: string; size?: number }) {
  const colors = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6','#EC4899']
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
export default function AddShiftModal({ date, onClose, onAdd }: { date: Date; onClose: () => void; onAdd: (shift: ShiftInput) => void }) {
  const { t } = useTranslation('planning')
  const [title,      setTitle]      = useState('Dagdienst')
  const [start,      setStart]      = useState('07:00')
  const [end,        setEnd]        = useState('15:00')
  const [jobtype,    setJobtype]    = useState('Verzorgende IG')
  const [klant,      setKlant]      = useState('Stichting Rivas Zorggroep')
  const [afdeling,   setAfdeling]   = useState('Watertorenlocatie')
  const [locatie,    setLocatie]    = useState('Boezemlaan 4, 2771 VP Boskoop')
  const [personen,   setPersonen]   = useState(1)
  const [kandidaat,  setKandidaat]  = useState<Suggestie | null>(null)
  const [zoek,       setZoek]       = useState('')
  const [color,      setColor]      = useState('var(--color-success)')
  const COLORS = ['var(--color-success)','var(--color-primary)','var(--color-warning)','var(--color-danger)','var(--color-secondary)','#8B5CF6']

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
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sidebar-text)' }}>{t('addShift')}</span>
              <span style={{ fontSize: 12, color: 'var(--sidebar-muted)', marginLeft: 10 }}>{formatDate(date)}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={handleSave}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 12,
                  fontWeight: 600, background: 'var(--color-primary)', color: '#fff',
                  border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                <Save size={13} /> {t('common:save')}
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
              <SectionHead>{t('sectionOrder')}</SectionHead>
              <Field label={t('fCustomer')}>
                <select style={SELECT} value={klant} onChange={e => setKlant(e.target.value)}>
                  <option>Stichting Rivas Zorggroep</option>
                  <option>Yesway Zorg</option>
                  <option>WoonzorgGroep</option>
                  <option>Stichting Floravita</option>
                </select>
              </Field>
              <Field label={t('fDepartment')}>
                <select style={SELECT} value={afdeling} onChange={e => setAfdeling(e.target.value)}>
                  <option>Watertorenlocatie</option>
                  <option>Hoofdkantoor</option>
                  <option>Thuiszorg</option>
                </select>
              </Field>
              <Field label={t('fAssignment')}><input style={INPUT} defaultValue="Watertorenlocatie" /></Field>
              <Field label={t('fContact')}><input style={INPUT} placeholder={t('contactPlaceholder')} /></Field>

              <SectionHead>{t('sectionLocation')}</SectionHead>
              <Field label={t('fAddress')}>
                <textarea style={{ ...INPUT, resize: 'none', height: 56 }}
                  value={locatie} onChange={e => setLocatie(e.target.value)} />
              </Field>

              <SectionHead>{t('sectionColor')}</SectionHead>
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
              <SectionHead>{t('shift1')}</SectionHead>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <Field label={t('fShiftName')}>
                  <input style={INPUT} value={title} onChange={e => setTitle(e.target.value)} />
                </Field>
                <Field label={t('fStart')}>
                  <input type="time" style={INPUT} value={start} onChange={e => setStart(e.target.value)} />
                </Field>
                <Field label={t('fEnd')}>
                  <input type="time" style={INPUT} value={end} onChange={e => setEnd(e.target.value)} />
                </Field>
                <Field label={t('fPersons')}>
                  <input type="number" style={INPUT} value={personen} min={1} max={20}
                    onChange={e => setPersonen(Number(e.target.value))} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <Field label={t('fJobtype')}>
                  <select style={SELECT} value={jobtype} onChange={e => setJobtype(e.target.value)}>
                    <option>Verzorgende IG</option>
                    <option>Helpende</option>
                    <option>Verpleegkundige</option>
                    <option>Gastvrouw</option>
                    <option>Zorgmedewerker</option>
                  </select>
                </Field>
                <Field label={t('fOpenShift')}>
                  <select style={SELECT}>
                    <option>{t('openAll')}</option>
                    <option>{t('openFavorites')}</option>
                    <option>{t('openFixed')}</option>
                  </select>
                </Field>
              </div>

              {/* Scheduled candidate */}
              <SectionHead>{t('scheduledWorker')}</SectionHead>
              {kandidaat ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  border: `1px solid ${kandidaat.color}40`, borderLeft: `4px solid ${kandidaat.color}`,
                  borderRadius: 8, background: 'var(--surface)', marginBottom: 10 }}>
                  <Avatar initials={kandidaat.initials} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{kandidaat.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{kandidaat.functie} · {t('hours', { n: kandidaat.uren })} · {kandidaat.km}</div>
                  </div>
                  <button onClick={() => setKandidaat(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)',
                  borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {t('clickCandidate')}
                </div>
              )}

              {/* Notes */}
              <SectionHead>{t('notes')}</SectionHead>
              <textarea style={{ ...INPUT, height: 70, resize: 'none' }} placeholder={t('notePlaceholder')} />

              {/* Assignment performance */}
              <SectionHead style={{ marginTop: 16 }}>{t('performance')}</SectionHead>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {[t('colName'), t('colClient'), t('colFunction'), t('colColleagues')].map(h => (
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
                        {t('noWorkerPlanned')}
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
                    placeholder={t('searchCandidate')}
                    style={{ ...INPUT, paddingLeft: 28, fontSize: 12 }} />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>

                {/* Favorieten */}
                {favorieten.length > 0 && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em',
                      textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={10} /> {t('favorites')}
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
                  {t('suggestions')} — {jobtype}
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

function KandidaatRij({ s, selected, onClick }: { s: Suggestie; selected?: boolean; onClick?: () => void }) {
  const { t } = useTranslation('planning')
  return (
    <div {...interactive(onClick)}
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
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('hours', { n: s.uren })} · {s.km}</div>
      </div>
      {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
    </div>
  )
}
