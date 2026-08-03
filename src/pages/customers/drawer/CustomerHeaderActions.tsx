/**
 * CustomerHeaderActions — the customer drawer header's action row (§0.3 split
 * from CustomerDrawer, mirrors the candidate's CandidateHeaderActions): a
 * prominent "Convert to Customer" button while the customer sits in the entry
 * (Prospect) phase, plus the edit/save/cancel toggles for the header name.
 * Pure rendering; all state and mutations arrive via props.
 */
import { useTranslation } from 'react-i18next'
import { Edit2, Save, UserCheck, X } from 'lucide-react'
import { BTN_H } from '@/config/buttonMetrics'
import type { CustomerPhaseOption } from '@/lib/useCustomerPhases'

const iconBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0 } as const

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
        <button onClick={onConvert}
          style={{ display: 'flex', alignItems: 'center', gap: 4, height: BTN_H, padding: '0 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'white' }}>
          <UserCheck size={11} />{t('drawer.convertTo', { phase: targetPhase.label })}
        </button>
      )}
      {/* Edit-pencil that toggles to save/cancel (same pattern as the candidate header). */}
      {headerEditing ? (
        <>
          <button onClick={onSaveEdit} title={t('drawer.save')}
            style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            <Save size={14} />
          </button>
          <button onClick={onCancelEdit} title={t('drawer.cancel')}
            style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <X size={14} />
          </button>
        </>
      ) : (
        <button onClick={onStartEdit} title={t('drawer.edit')}
          style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Edit2 size={13} />
        </button>
      )}
    </>
  )
}
