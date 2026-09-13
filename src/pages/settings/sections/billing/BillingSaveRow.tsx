/**
 * BillingSaveRow — the SaveButton row shared by BillingBudgetsCard and
 * BillingUsersCard: saved/saving/idle states in the shared SaveButton, only the
 * "saved" label differs (own i18n namespace per card).
 */
import type { CSSProperties } from 'react'
import { Check, Save } from 'lucide-react'
import SaveButton from '@/components/ui/SaveButton'
import Spinner from '@/components/ui/Spinner'

export default function BillingSaveRow({ onClick, disabled, saving, savedOk, savedLabel, savingLabel, saveLabel, style }: {
  onClick: () => void
  disabled: boolean
  saving: boolean
  savedOk: boolean
  savedLabel: string
  savingLabel: string
  saveLabel: string
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <SaveButton onClick={onClick} disabled={disabled} saved={savedOk}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {savedOk ? <><Check size={13} /> {savedLabel}</>
        : saving  ? <><Spinner size={13} /> {savingLabel}</>
        :           <><Save size={13} /> {saveLabel}</>}
      </SaveButton>
    </div>
  )
}
