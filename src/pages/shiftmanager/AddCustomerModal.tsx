import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building2 } from 'lucide-react'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { BTN_H } from '@/config/buttonMetrics'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

// The new-customer form fields (unchanged shape — CustomersPage.tsx imports this
// type and builds its optimistic row from exactly these keys).
export interface CustomerForm { name: string; debtorNumber: string; status: string; accountManager: string; city: string }

// This Shiftmanager mirror has no industry/establishment field (unlike the
// native customer entity), so "Bedrijf" absorbs debtorNumber+city instead of a
// separate sparse "Vestiging & plaats" card — see the delivery report.
const STATUSES = ['actief', 'prospect', 'inactief', 'geblokkeerd']

export default function AddCustomerModal({ onClose, onCreate }: { onClose: () => void; onCreate?: (form: CustomerForm) => void }) {
  const { t } = useTranslation('customers')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const [errors, setErrors] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<CustomerForm>({ name: '', debtorNumber: '', status: 'prospect', accountManager: '', city: '' })

  const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: false })) }

  const handleSubmit = () => {
    if (!form.name.trim()) { setErrors({ name: true }); return }
    onCreate?.(form)
    onClose()
  }

  const canSubmit = !!form.name.trim()
  // customers.json's status.* group (actief/prospect/inactief/geblokkeerd) already
  // covers this hardcoded list; the raw value is kept only as a defensive fallback
  // if a key is ever missing, so the key path never leaks to the UI.
  const statusOptions = STATUSES.map(s => ({ value: s, label: t(`status.${s}`, s) }))

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('modal.title')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', ...WIDE_MODAL,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

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

        {/* Body — titled bordered cards: Bedrijf (name/debtor/city) then
            Eigenaar & status (reuses the SAME 'customers' i18n keys the native
            modal just gained, one translation source for both variants). */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={cardHead}>{t('modal.fields.cardCompany')}</div>
            <div style={cardBox}>
              <div>
                <Field label={t('modal.fields.name')} required>
                  <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('modal.fields.namePlaceholder')} error={errors.name} />
                </Field>
                {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
              </div>
              <div style={row2}>
                <Field label={t('modal.fields.debtorNumber')}>
                  <TextField value={form.debtorNumber} onChange={v => set('debtorNumber', v)} placeholder="10042" />
                </Field>
                <Field label={t('modal.fields.city')}>
                  <TextField value={form.city} onChange={v => set('city', v)} placeholder={t('modal.fields.cityPlaceholder')} />
                </Field>
              </div>
            </div>
          </div>

          <div>
            <div style={cardHead}>{t('modal.fields.cardOwnerStatus')}</div>
            <div style={cardBox}>
              <div style={row2}>
                <Field label={t('modal.fields.accountManager')}>
                  <TextField value={form.accountManager} onChange={v => set('accountManager', v)} placeholder="—" />
                </Field>
                {/* Status — searchable (Danny 27-07), never a bare `<select>`.
                    Placeholder given even though a default is always selected — it
                    becomes the search box's accessible label once opened (§6). */}
                <Field label={t('modal.fields.status')}>
                  <CreatableSelect value={form.status || null} onChange={v => set('status', v)} allowCreate={false}
                    placeholder={t('modal.fields.status')} options={statusOptions} />
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {t('modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ height: BTN_H, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--color-primary)' : 'var(--border)', color: canSubmit ? 'white' : 'var(--text-muted)',
              cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
