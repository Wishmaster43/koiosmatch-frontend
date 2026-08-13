/**
 * CustomerCompanyCard — the "Bedrijf" card of AddCustomerModal: name (required)
 * + industry (tenant lookup) + employee count. Extracted (§0.3 — the ~400-line
 * split trigger, 2026-08-03) once this week's address/import cards pushed the
 * parent past its target; pure presentational, mirrors the house `form`+`set`
 * card pattern (addmodal/CustomerAddressCard.tsx) — every value and callback
 * comes from the parent's own form state, no local state of its own.
 */
import { useTranslation } from 'react-i18next'
import type { CustomerForm } from '../AddCustomerModal'
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

interface CustomerCompanyCardProps {
  form: CustomerForm
  set: (k: keyof CustomerForm, v: string) => void
  errors: Record<string, boolean>
  // useIndustries() returns a plain string list (tenant sector names), not a
  // {value,label} lookup — matches the original inline CreatableSelect usage.
  industries: string[]
}

export default function CustomerCompanyCard({ form, set, errors, industries }: CustomerCompanyCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardCompany')}</div>
      <div style={cardBox}>
        <div>
          <Field label={t('modal.fields.name')} required>
            <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('modal.fields.namePlaceholder')} error={errors.name} />
          </Field>
          {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{t('modal.required')}</div>}
        </div>
        {/* DEBITEURNUMMER-1 (Danny 02-08): the debtor number is no longer collected
            here — it is the customer's own accounting number, decided later, and
            stays editable everywhere else (drawer/table/search). Two fields remain. */}
        <div style={row2}>
          {/* Branche (industry/sector) — searchable tenant lookup, distinct from the
              "Vestiging" (establishment) picker below. */}
          <Field label={t('modal.fields.industry')}>
            {/* CLEAR-SWEEP (Danny 13-08): industry is genuinely optional (the create
                body sends it unconditionally, empty string included — see
                useCustomerRecord.handleCreate) — so clearable. */}
            <CreatableSelect value={form.industry || null} onChange={v => set('industry', v)} allowCreate={false}
              clearable clearLabel={t('modal.fields.industry')}
              placeholder={t('modal.fields.selectIndustry')} options={industries} />
          </Field>
          <Field label={t('overview.employeeCount')}>
            <TextField type="number" value={form.employeeCount} onChange={v => set('employeeCount', v)} />
          </Field>
        </div>
      </div>
    </div>
  )
}
