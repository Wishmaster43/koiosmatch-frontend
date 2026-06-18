import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, MapPin } from 'lucide-react'

const iStyle = {
  width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}
const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }

export default function AddLocationModal({ onClose, onCreate, customerName }) {
  const { t } = useTranslation('customers')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState(false)

  const submit = () => {
    if (!name.trim()) { setError(true); return }
    onCreate?.({ name: name.trim(), city: city.trim() })
    onClose()
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={15} color="var(--color-secondary)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('subModal.addLocation')}</div>
              {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('subModal.locationName')}<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); setError(false) }} placeholder={t('subModal.locationPlaceholder')}
              style={{ ...iStyle, borderColor: error ? 'var(--color-danger)' : undefined }} />
            {error && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
          </div>
          <div>
            <label style={labelStyle}>{t('subModal.city')}</label>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="—" style={iStyle} />
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!name.trim()} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: name.trim() ? 'var(--color-primary)' : '#E5E7EB', color: name.trim() ? 'white' : '#9CA3AF', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>{t('subModal.create')}</button>
        </div>
      </div>
    </div>
  )
}
