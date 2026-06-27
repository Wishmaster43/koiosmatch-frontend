import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Building2, ChevronDown } from 'lucide-react'

// The new-customer form fields.
export interface CustomerForm { name: string; debtorNumber: string; status: string; accountManager: string; city: string }

const iStyle: CSSProperties = {
  width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
    </label>
  )
}

const STATUSES = ['actief', 'prospect', 'inactief', 'geblokkeerd']

export default function AddCustomerModal({ onClose, onCreate }: { onClose: () => void; onCreate?: (form: CustomerForm) => void }) {
  const { t } = useTranslation('customers')
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<CustomerForm>({ name: '', debtorNumber: '', status: 'prospect', accountManager: '', city: '' })

  const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  const handleSubmit = () => {
    if (!form.name.trim()) { setErrors({ name: true }); return }
    onCreate?.(form)
    onClose()
  }

  const canSubmit = !!form.name.trim()

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={16} color="var(--color-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('modal.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('modal.subtitle')}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label required>{t('modal.fields.name')}</Label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('modal.fields.namePlaceholder')}
              style={{ ...iStyle, borderColor: errors.name ? 'var(--color-danger)' : undefined }} />
            {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>{t('modal.fields.debtorNumber')}</Label>
              <input value={form.debtorNumber} onChange={e => set('debtorNumber', e.target.value)} placeholder="10042" style={iStyle} />
            </div>
            <div>
              <Label>{t('modal.fields.status')}</Label>
              <div style={{ position: 'relative' }}>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  style={{ ...iStyle, appearance: 'none', paddingRight: 30, cursor: 'pointer' }}>
                  {STATUSES.map(s => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
                </select>
                <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>{t('modal.fields.accountManager')}</Label>
              <input value={form.accountManager} onChange={e => set('accountManager', e.target.value)} placeholder="—" style={iStyle} />
            </div>
            <div>
              <Label>{t('modal.fields.city')}</Label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder={t('modal.fields.cityPlaceholder')} style={iStyle} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--hover-bg)' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'white' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
