import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Building2, ChevronDown } from 'lucide-react'
import { useIndustries } from '../../lib/useIndustries'
import type { Id, LookupOption } from '../../types/common'

const iStyle: CSSProperties = {
  width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}
const selectStyle: CSSProperties = { ...iStyle, appearance: 'none', paddingRight: 30, cursor: 'pointer' }
const chevron: CSSProperties = { position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
    </label>
  )
}

interface CustomerForm { name: string; debtorNumber: string; status: string; ownerId: string; industry: string; city: string }
interface ModalUser { id: Id; name: string }

/**
 * AddCustomerModal — create a customer. Status comes from the tenant lookup,
 * account manager from the user list and industry from /industries — never
 * hardcoded option lists. Returns the raw form via onCreate; the page persists.
 */
export default function AddCustomerModal({ onClose, onCreate, users = [], statuses = [] }: {
  onClose: () => void; onCreate?: (form: CustomerForm) => void; users?: ModalUser[]; statuses?: LookupOption[]
}) {
  const { t } = useTranslation('customers')
  const { industries } = useIndustries()
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<CustomerForm>({ name: '', debtorNumber: '', status: statuses[0]?.value ?? '', ownerId: '', industry: '', city: '' })

  const set = (k: keyof CustomerForm, v: string) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  const handleSubmit = () => {
    if (!form.name.trim()) { setErrors({ name: true }); return }
    onCreate?.(form)
  }
  const canSubmit = !!form.name.trim()

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520,
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
              aria-label={t('modal.fields.name')}
              style={{ ...iStyle, borderColor: errors.name ? 'var(--color-danger)' : undefined }} />
            {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>{t('modal.fields.debtorNumber')}</Label>
              <input value={form.debtorNumber} onChange={e => set('debtorNumber', e.target.value)} placeholder="10042" aria-label={t('modal.fields.debtorNumber')} style={iStyle} />
            </div>
            <div>
              <Label>{t('modal.fields.status')}</Label>
              <div style={{ position: 'relative' }}>
                <select value={form.status} onChange={e => set('status', e.target.value)} aria-label={t('modal.fields.status')} style={selectStyle}>
                  {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={13} style={chevron} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>{t('modal.fields.accountManager')}</Label>
              <div style={{ position: 'relative' }}>
                <select value={form.ownerId} onChange={e => set('ownerId', e.target.value)} aria-label={t('modal.fields.accountManager')} style={selectStyle}>
                  <option value="">{t('modal.fields.selectOwner')}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <ChevronDown size={13} style={chevron} />
              </div>
            </div>
            <div>
              <Label>{t('modal.fields.industry')}</Label>
              <div style={{ position: 'relative' }}>
                <select value={form.industry} onChange={e => set('industry', e.target.value)} aria-label={t('modal.fields.industry')} style={selectStyle}>
                  <option value="">{t('modal.fields.selectIndustry')}</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <ChevronDown size={13} style={chevron} />
              </div>
            </div>
          </div>

          <div>
            <Label>{t('modal.fields.city')}</Label>
            <input value={form.city} onChange={e => set('city', e.target.value)} placeholder={t('modal.fields.cityPlaceholder')} aria-label={t('modal.fields.city')} style={iStyle} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : '#E5E7EB', color: canSubmit ? 'white' : '#9CA3AF',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
