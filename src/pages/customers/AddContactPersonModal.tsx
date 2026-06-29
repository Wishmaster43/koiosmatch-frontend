import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Users } from 'lucide-react'

const iStyle: CSSProperties = {
  width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}
const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }

interface ContactForm { name: string; role: string; email: string }

export default function AddContactPersonModal({ onClose, onCreate, customerName }: {
  onClose: () => void; onCreate?: (v: ContactForm) => void; customerName?: string
}) {
  const { t } = useTranslation('customers')
  const [form, setForm] = useState<ContactForm>({ name: '', role: '', email: '' })
  const [error, setError] = useState(false)
  const set = (k: keyof ContactForm, v: string) => { setForm(f => ({ ...f, [k]: v })); if (k === 'name') setError(false) }

  const submit = () => {
    if (!form.name.trim()) { setError(true); return }
    onCreate?.({ name: form.name.trim(), role: form.role.trim(), email: form.email.trim() })
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={15} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('subModal.addContact')}</div>
              {customerName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{customerName}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('subModal.contactName')}<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('subModal.contactPlaceholder')}
              aria-label={t('subModal.contactName')}
              style={{ ...iStyle, borderColor: error ? 'var(--color-danger)' : undefined }} />
            {error && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('subModal.required')}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{t('subModal.role')}</label>
              <input value={form.role} onChange={e => set('role', e.target.value)} placeholder="—" aria-label={t('subModal.role')} style={iStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('subModal.email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="naam@klant.nl" aria-label={t('subModal.email')} style={iStyle} />
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>{t('subModal.cancel')}</button>
          <button onClick={submit} disabled={!form.name.trim()} style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', background: form.name.trim() ? 'var(--color-primary)' : '#E5E7EB', color: form.name.trim() ? 'white' : '#9CA3AF', cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>{t('subModal.create')}</button>
        </div>
      </div>
    </div>
  )
}
