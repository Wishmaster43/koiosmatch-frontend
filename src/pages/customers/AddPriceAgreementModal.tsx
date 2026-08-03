/**
 * AddPriceAgreementModal — the "+ Nieuwe prijsafspraak" popup (Danny 03-08:
 * PriceAgreementsTab's "+" was the one trigger left expanding an INLINE form
 * instead of opening a modal like every other "+ action" in the app). Wraps
 * the existing PriceAgreementForm in the house dialog chrome (overlay +
 * centered panel, focus-trapped, Escape/backdrop closes) — the form itself
 * moves here unchanged, only the container around it changes from inline
 * expansion to a popup. A COMPACT footprint (480px, single column), not the
 * WIDE_MODAL two-column frame: PriceAgreementForm is one column of ~8 fields,
 * nothing that needs the wide two-card layout the bigger entities use.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import PriceAgreementForm from './drawer/PriceAgreementForm'
import type { PriceAgreementDraft } from './drawer/PriceAgreementForm'

// Overlay/panel frame mirrors RejectionModal/DetachReasonModal (§ house rule
// for a compact reason/form popup opened from inside an entity drawer tab).
const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }
const panel: CSSProperties = {
  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 71,
  width: 480, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 12, padding: 20,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '88vh', overflowY: 'auto',
}

interface Props {
  draft: PriceAgreementDraft
  onChange: (patch: Partial<PriceAgreementDraft>) => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
}

export default function AddPriceAgreementModal({ draft, onChange, onSave, onCancel, saveLabel }: Props) {
  const { t } = useTranslation(['customers', 'common'])
  const panelRef = useFocusTrap<HTMLDivElement>(onCancel)

  return (
    <>
      <div style={overlay} onClick={onCancel} />
      <div ref={panelRef} style={panel} role="dialog" aria-modal="true" aria-label={t('priceAgreements.add')} tabIndex={-1}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('priceAgreements.add')}</span>
          <button onClick={onCancel} aria-label={t('common:close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        {/* The form itself is unchanged (fields + its own Cancel/Save row) — this
            popup only supplies the dialog chrome around it. */}
        <PriceAgreementForm draft={draft} onChange={onChange} onSave={onSave} onCancel={onCancel} saveLabel={saveLabel} />
      </div>
    </>
  )
}
