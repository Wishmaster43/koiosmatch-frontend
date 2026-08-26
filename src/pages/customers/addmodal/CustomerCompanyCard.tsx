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
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox } from '@/components/ui/modalCards'

interface CustomerCompanyCardProps {
  form: CustomerForm
  set: (k: keyof CustomerForm, v: string) => void
  errors: Record<string, boolean>
  // useIndustries() returns a plain string list (tenant sector names), not a
  // {value,label} lookup — matches the original inline CreatableSelect usage.
  // { value: the stored seed name, label: translated for display }
  industries: Array<{ value: string; label: string }>
}

// The company-details card fields; industries come from the tenant lookup as plain seed names, translated only for display.
export default function CustomerCompanyCard({ form, set, errors, industries }: CustomerCompanyCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardCompany')}</div>
      <div style={cardBox}>
        <div>
          <FieldRow label={t('modal.fields.name')} required>
            {/* A company name is not a person's name — its own example, never fullNameExample. */}
            <TextField value={form.name} onChange={v => set('name', v)} placeholder={t('common:placeholders.companyNameExample')} error={errors.name} />
          </FieldRow>
          {errors.name && <div style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 3 }}>{t('modal.required')}</div>}
        </div>
        {/* CUST-DUP-FE-1 (22-08): KvK number — the tenant's DEFAULT primary dedupe key
            (customer_dedupe_keys). Optional (a brand-new prospect may not have one
            yet); reuses the drawer's own "overview.coc" label (ONE label per thing). */}
        <FieldRow label={t('overview.coc')}>
          <TextField value={form.cocNumber} onChange={v => set('cocNumber', v)} />
        </FieldRow>
        {/* DEBITEURNUMMER-1 (Danny 02-08): the debtor number is no longer collected
            here — it is the customer's own accounting number, decided later, and
            stays editable everywhere else (drawer/table/search). Two fields remain. */}
        {/* KLANT-LAYOUT-4 (Danny 14-08: "branche en werknemers ziet er gek uit nadat
            je er 1 gekozen hebt"): pairing two label-left fields on one grid row left
            the second input a stub, and a picked industry made the imbalance obvious.
            Each field owns its row now, like Naam above. */}
        {/* Branche (industry/sector) — searchable tenant lookup, distinct from the
            "Vestiging" (establishment) picker below. */}
        <FieldRow label={t('modal.fields.industry')}>
          {/* CLEAR-SWEEP (Danny 13-08): industry is genuinely optional (the create
              body sends it unconditionally, empty string included — see
              useCustomerRecord.handleCreate) — so clearable. */}
          <CreatableSelect value={form.industry || null} onChange={v => set('industry', v)} allowCreate={false}
            clearable clearLabel={t('modal.fields.industry')}
            placeholder={t('modal.fields.selectIndustry')} options={industries} />
        </FieldRow>
        <FieldRow label={t('overview.employeeCount')}>
          <TextField type="number" value={form.employeeCount} onChange={v => set('employeeCount', v)} />
        </FieldRow>
      </div>
    </div>
  )
}
