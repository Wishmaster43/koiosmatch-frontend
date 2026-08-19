/**
 * CustomerHeaderActions — the customer drawer header's action row (§0.3 split
 * from CustomerDrawer, mirrors the candidate's CandidateHeaderActions): a
 * prominent "Convert to Customer" button while the customer sits in the entry
 * (Prospect) phase, plus the edit/save/cancel toggles for the header name.
 * Pure rendering; all state and mutations arrive via props.
 */
import { useTranslation } from 'react-i18next'
import { Edit2, Save, UserCheck, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { CustomerPhaseOption } from '@/lib/useCustomerPhases'

interface Props {
  isEntryPhase: boolean
  targetPhase?: CustomerPhaseOption
  onConvert: () => void
  headerEditing: boolean
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
}

export default function CustomerHeaderActions({ isEntryPhase, targetPhase, onConvert, headerEditing, onStartEdit, onSaveEdit, onCancelEdit }: Props) {
  const { t } = useTranslation('customers')

  return (
    <>
      {/* KLANT-FASE-CONVERT-1: entry phase (Prospect) → one-click convert to the
          isCustomer-flagged phase, same BTN_H/weight as the candidate's convert
          button (§3A(c)) — one click, no confirmation modal. No isCustomer option
          configured on the tenant's lookup → render no button at all. */}
      {isEntryPhase && targetPhase && (
        <Button variant="primary" onClick={onConvert}>
          <UserCheck size={11} />{t('drawer.convertTo', { phase: targetPhase.label })}
        </Button>
      )}
      {/* Edit-pencil that toggles to save/cancel (same pattern as the candidate header). */}
      {headerEditing ? (
        <>
          <Button variant="primary" iconOnly size="sm" onClick={onSaveEdit} title={t('drawer.save')}>
            <Save size={14} />
          </Button>
          <Button variant="secondary" iconOnly size="sm" onClick={onCancelEdit} title={t('drawer.cancel')}>
            <X size={14} />
          </Button>
        </>
      ) : (
        <Button variant="secondary" iconOnly size="sm" onClick={onStartEdit} title={t('drawer.edit')}>
          <Edit2 size={13} />
        </Button>
      )}
    </>
  )
}
