import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import api from '../../lib/api'

export default function AddCandidaatModal({ onClose }) {
  const [type,       setType]       = useState('')
  const [vacatures,  setVacatures]  = useState([])
  const [kandidaten, setKandidaten] = useState([])
  const [vakRef,     setVakRef]     = useState('')
  const [form,       setForm]       = useState({ voornaam: '', achternaam: '', email: '', telefoon: '' })

  useEffect(() => {
    if (type !== 'sollicitant') return
    api.get('/vacancies').then(r => { const d = r.data; setVacatures(Array.isArray(d) ? d : (d?.data ?? [])) }).catch(() => {})
    api.get('/candidates').then(r => { const d = r.data; setKandidaten(Array.isArray(d) ? d : (d?.data ?? [])) }).catch(() => {})
  }, [type])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 14, width: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Kandidaat toevoegen</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Type</label>
            <select value={type} onChange={e => { setType(e.target.value); setVakRef('') }}
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
              <option value="">— Selecteer type —</option>
              <option value="lead">Lead</option>
              <option value="sollicitant">Sollicitant</option>
            </select>
          </div>

          {/* Sollicitant: link to vacancy or candidate */}
          {type === 'sollicitant' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Koppelen aan</label>
              <select value={vakRef} onChange={e => setVakRef(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                <option value="">— Vacature of kandidaat —</option>
                {vacatures.length > 0 && (
                  <optgroup label="Vacatures">
                    {vacatures.map(v => <option key={`v-${v.id}`} value={`vacature-${v.id}`}>{v.title ?? v.name ?? `Vacature ${v.id}`}</option>)}
                  </optgroup>
                )}
                {kandidaten.length > 0 && (
                  <optgroup label="Kandidaten">
                    {kandidaten.map(k => <option key={`k-${k.id}`} value={`kandidaat-${k.id}`}>{k.name ?? k.full_name ?? `Kandidaat ${k.id}`}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {/* Name fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['voornaam','Voornaam'],['achternaam','Achternaam']].map(([k, l]) => (
              <div key={k}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{l}</label>
                <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={l}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>

          {/* Email + Phone */}
          {[['email','E-mailadres','email'],['telefoon','Telefoon','tel']].map(([k, l, t]) => (
            <div key={k}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{l}</label>
              <input type={t} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={l}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            Annuleren
          </button>
          <button disabled={!type}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
              background: type ? 'var(--color-primary)' : '#D1D5DB', color: 'white', cursor: type ? 'pointer' : 'not-allowed' }}>
            Toevoegen
          </button>
        </div>
      </div>
    </div>
  )
}
