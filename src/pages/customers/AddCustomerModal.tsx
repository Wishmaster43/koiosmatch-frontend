import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Building2, ChevronDown } from 'lucide-react'
import { useIndustries } from '@/lib/useIndustries'
import { BTN_H } from '@/config/buttonMetrics'
import type { Id, LookupOption } from '@/types/common'

const iStyle: CSSProperties = {
  width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}
const selectStyle: CSSProperties = { ...iStyle, appearance: 'none', paddingRight: 30, cursor: 'pointer' }
const chevron: CSSProperties = { position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
    </label>
  )
}

interface CustomerForm { name: string; debtorNumber: string; status: string; ownerId: string; industry: string; city: string }
interface ModalUser { id: Id; name: string }

// 422 field-error keys are snake_case; map them back to this form's field names.
const API_TO_FORM: Record<string, string> = {
  name: 'name', debtor_number: 'debtorNumber', status: 'status', owner_id: 'ownerId', industry: 'industry', city: 'city',
}

/**
 * AddCustomerModal — create a customer. Status comes from the tenant lookup,
 * account manager from the user list and industry from /industries — never
 * hardcoded option lists. Awaits onCreate (the page's POST) and only closes on
 * success (C-18) — it used to fire-and-forget while the page closed it regardless.
 */
export default function AddCustomerModal({ onClose, onCreate, users = [], statuses = [] }: {
  onClose: () => void; onCreate?: (form: CustomerForm) => unknown; users?: ModalUser[]; statuses?: LookupOption[]
}) {
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { industries } = useIndustries()
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  // Non-field 422/generic failure.
  const [createError, setCreateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CustomerForm>({ name: '', debtorNumber: '', status: statuses[0]?.value ?? '', ownerId: '', industry: '', city: '' })

  const set = (k: keyof CustomerForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (errors[k]) setErrors(e => ({ ...e, [k]: false }))
    setCreateError(null)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErrors({ name: true }); return }
    setSaving(true)
    try {
      await onCreate?.(form)
      onClose()
    } catch (err) {
      // Show field-level errors from 422 validation responses; fall back to the
      // server's message (or a generic one) so the user isn't left guessing.
      const e = err as { response?: { data?: { errors?: Record<string, unknown>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        const e2: Record<string, boolean> = {}
        Object.keys(apiErrors).forEach(k => { e2[API_TO_FORM[k] ?? k] = true })
        setErrors(e2)
      } else {
        setCreateError(e?.response?.data?.message ?? t('common:errorGeneric'))
      }
    } finally {
      setSaving(false)
    }
  }
  const canSubmit = !!form.name.trim() && !saving

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('modal.title')} tabIndex={-1}
        style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520,
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
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
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

        {/* Server-side rejection (non-field 422 / other failure) — shown in place, modal stays open. */}
        {createError && (
          <div role="alert" style={{ margin: '0 24px 8px', padding: '8px 10px', fontSize: 12, borderRadius: 8,
            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', flexShrink: 0 }}>
            {createError}
          </div>
        )}

        {/* Footer — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--hover-bg)' }}>
          <button onClick={onClose}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'white' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {saving ? t('common:saving') : t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
