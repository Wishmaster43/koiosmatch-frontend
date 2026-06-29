import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Building, ChevronDown } from 'lucide-react'
import type { Id } from '../../types/common'

const iStyle: CSSProperties = {
  width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}
const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }

interface LocationOption { id: Id; name: string }

export default function AddDepartmentModal({ onClose, onCreate, locations = [], customerName }: {
  onClose: () => void
  onCreate?: (v: { name: string; locationId: Id }) => void
  locations?: LocationOption[]
  customerName?: string
}) {
  const { t } = useTranslation('customers')
  const [name, setName] = useState('')
  const [locationId, setLocationId] = useState<Id | ''>(locations[0]?.id ?? '')
  const [error, setError] = useState(false)

  const submit = () => {
    if (!name.trim() || !locationId) { setError(true); return }
    onCreate?.({ name: name.trim(), locationId })
    onClose()
  }

  const canSubmit = !!name.trim() && !!locationId

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={15} color="#8B5CF6" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('subModal.addDepartment')}</div>
              {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('subModal.selectLocation')}<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
            {locations.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--color-warning)', padding: '8px 11px', border: '1px solid var(--color-warning)', borderRadius: 8, background: 'var(--color-warning-bg)' }}>
                {t('subModal.noLocationsFirst')}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <select value={locationId} onChange={e => { setLocationId(e.target.value); setError(false) }}
                  aria-label={t('subModal.selectLocation')}
                  style={{ ...iStyle, appearance: 'none', paddingRight: 30, cursor: 'pointer' }}>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>{t('subModal.departmentName')}<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); setError(false) }} placeholder={t('subModal.departmentPlaceholder')}
              aria-label={t('subModal.departmentName')}
              style={{ ...iStyle, borderColor: error && !name.trim() ? 'var(--color-danger)' : undefined }} />
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: canSubmit ? 'var(--color-primary)' : '#E5E7EB', color: canSubmit ? 'white' : '#9CA3AF', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>{t('subModal.create')}</button>
        </div>
      </div>
    </div>
  )
}
