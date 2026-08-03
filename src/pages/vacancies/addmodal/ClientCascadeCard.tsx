/**
 * ClientCascadeCard — Klant: the REAL searchable klant -> locatie -> afdeling ->
 * contactpersoon cascade (punt 6), replacing the old silent id-passthrough +
 * info-line. `lockCustomerId` keeps the customer read-only, but every level
 * below it stays editable and clearable (punt 3: afdeling optioneel) — the
 * pickers themselves come from the shared `useCascadePickers` (mirrors
 * MatchModal/DetailsGeneralTab), so this card is purely presentational.
 */
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { Field } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row3Even } from '@/components/ui/modalCards'

interface Props {
  lockCustomerId?: string; lockCustomerName?: string
  clientId: string; onClientChange: (v: string) => void
  customerOptions: Array<{ value: string; label: string }>
  locationPicker: ReactNode; departmentPicker: ReactNode; contactPicker: ReactNode
}

export default function ClientCascadeCard({
  lockCustomerId, lockCustomerName, clientId, onClientChange, customerOptions, locationPicker, departmentPicker, contactPicker,
}: Props) {
  const { t } = useTranslation(['vacancies', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('modal.fields.cardClient')}</div>
      <div style={cardBox}>
        <Field label={t('modal.fields.client')}>
          {lockCustomerId
            ? (
              // Read-only: the drawer/scope this modal was opened from already fixes the customer.
              <div style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', color: 'var(--text-muted)' }}>{lockCustomerName ?? ''}</div>
            )
            : <CreatableSelect value={clientId || null} onChange={onClientChange} allowCreate={false}
                placeholder={t('common:select')} options={customerOptions} />}
        </Field>
        {/* Locatie -> afdeling -> contactpersoon — every level optional/clearable,
            editable even while the klant itself is locked. */}
        <div style={row3Even}>
          <Field label={t('details.customerLocation')}>{locationPicker}</Field>
          <Field label={t('details.customerDepartment')}>{departmentPicker}</Field>
          <Field label={t('details.contactPerson')}>{contactPicker}</Field>
        </div>
      </div>
    </div>
  )
}
