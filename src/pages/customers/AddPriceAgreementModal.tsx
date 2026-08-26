/**
 * AddPriceAgreementModal — the "+ Nieuwe prijsafspraak" popup (Danny 03-08:
 * PriceAgreementsTab's "+" was the one trigger left expanding an INLINE form
 * instead of opening a modal like every other "+ action" in the app). Wraps
 * the existing PriceAgreementForm in the house dialog chrome — the form itself
 * moves here unchanged, only the container around it changes from inline
 * expansion to a popup. A COMPACT footprint (480px, single column), not the
 * WIDE_MODAL two-column frame: PriceAgreementForm is one column of ~8 fields,
 * nothing that needs the wide two-card layout the bigger entities use.
 */
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import PriceAgreementForm from './drawer/PriceAgreementForm'
import type { PriceAgreementDraft } from './drawer/PriceAgreementForm'

interface Props {
  draft: PriceAgreementDraft
  onChange: (patch: Partial<PriceAgreementDraft>) => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
}

// Compact modal wrapper (see the module doc above): the existing form moves in unchanged, only the surrounding chrome changed from an inline expansion to a real popup.
export default function AddPriceAgreementModal({ draft, onChange, onSave, onCancel, saveLabel }: Props) {
  const { t } = useTranslation(['customers', 'common'])

  return (
    // POPUP-SLEEP-1: swapped the bespoke overlay/panel shell for the shared
    // draggable FloatingPanel — same focus-trap/backdrop/Esc semantics.
    <FloatingPanel open onClose={onCancel} title={t('priceAgreements.add')}
      ariaLabel={t('priceAgreements.add')} persistKey="customer-add-price-agreement"
      width={480} maxWidth="92vw" bodyStyle={{ padding: 20 }}>
      {/* The form itself is unchanged (fields + its own Cancel/Save row) — this
          popup only supplies the dialog chrome around it. */}
      <PriceAgreementForm draft={draft} onChange={onChange} onSave={onSave} onCancel={onCancel} saveLabel={saveLabel} />
    </FloatingPanel>
  )
}
