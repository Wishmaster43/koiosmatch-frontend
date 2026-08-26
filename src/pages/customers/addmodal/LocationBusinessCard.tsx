/**
 * LocationBusinessCard — the "Zakelijk" card of AddLocationModal: KvK/BTW
 * numbers + cost center (was two separate cards, merged Danny 27-07 so all
 * three fit one row at the wider width). Extracted (§0.3 — the ~400-line split
 * trigger, 2026-08-03); pure presentational, every value and callback comes
 * from the parent's own form state.
 */
import { useTranslation } from 'react-i18next'
import { FieldRow, TextField } from '@/components/forms/fields'
import FieldNotice from '@/components/ui/FieldNotice'
import { cardHead, cardBox, row3Even } from '@/components/ui/modalCards'
import type { IdentifierNotice } from '@/hooks/useIdentifierValidation'

interface LocationBusinessCardProps {
  cocNumber: string; onCocNumberChange: (v: string) => void
  vatNumber: string; onVatNumberChange: (v: string) => void
  costCenter: string; onCostCenterChange: (v: string) => void
  // KVK/BTW-PER-LAND-1 (Danny 08-08, points 10 + 11): the per-country format verdict,
  // computed by the container (it owns the country field) — this card only renders it.
  cocNotice?: IdentifierNotice | null
  vatNotice?: IdentifierNotice | null
}

// Pure presentational "Zakelijk" card: KvK/BTW numbers + cost center, with the
// per-country format verdicts (computed by the container) rendered alongside each field.
export default function LocationBusinessCard({
  cocNumber, onCocNumberChange, vatNumber, onVatNumberChange, costCenter, onCostCenterChange,
  cocNotice, vatNotice,
}: LocationBusinessCardProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <div>
      <div style={cardHead}>{t('subModal.groups.business')}</div>
      <div style={cardBox}>
        <div style={row3Even}>
          {/* The notice sits BESIDE the FieldRow, never inside it: FieldRow clones `id`/
              `aria-labelledby` onto its single child, so a wrapper div there would
              orphan the label from the real input (§6). */}
          <div>
            <FieldRow label={t('subModal.coc')}>
              <TextField value={cocNumber} onChange={onCocNumberChange} error={cocNotice?.severity === 'error'} />
            </FieldRow>
            <FieldNotice text={cocNotice?.message} severity={cocNotice?.severity} />
          </div>
          <div>
            <FieldRow label={t('subModal.vat')}>
              <TextField value={vatNumber} onChange={onVatNumberChange} error={vatNotice?.severity === 'error'} />
            </FieldRow>
            <FieldNotice text={vatNotice?.message} severity={vatNotice?.severity} />
          </div>
          <FieldRow label={t('subModal.costCenter')}><TextField value={costCenter} onChange={onCostCenterChange} /></FieldRow>
        </div>
      </div>
    </div>
  )
}
