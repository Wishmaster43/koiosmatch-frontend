/**
 * LocationBusinessCard — the "Zakelijk" card of AddLocationModal: KvK/BTW
 * numbers + cost center (was two separate cards, merged Danny 27-07 so all
 * three fit one row at the wider width). Extracted (§0.3 — the ~400-line split
 * trigger, 2026-08-03); pure presentational, every value and callback comes
 * from the parent's own form state.
 */
import { useTranslation } from 'react-i18next'
import { Field, TextField } from '@/components/forms/fields'
import { cardHead, cardBox, row3Even } from '@/components/ui/modalCards'

interface LocationBusinessCardProps {
  cocNumber: string; onCocNumberChange: (v: string) => void
  vatNumber: string; onVatNumberChange: (v: string) => void
  costCenter: string; onCostCenterChange: (v: string) => void
}

export default function LocationBusinessCard({
  cocNumber, onCocNumberChange, vatNumber, onVatNumberChange, costCenter, onCostCenterChange,
}: LocationBusinessCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('subModal.groups.business')}</div>
      <div style={cardBox}>
        <div style={row3Even}>
          <Field label={t('subModal.coc')}><TextField value={cocNumber} onChange={onCocNumberChange} /></Field>
          <Field label={t('subModal.vat')}><TextField value={vatNumber} onChange={onVatNumberChange} /></Field>
          <Field label={t('subModal.costCenter')}><TextField value={costCenter} onChange={onCostCenterChange} /></Field>
        </div>
      </div>
    </div>
  )
}
