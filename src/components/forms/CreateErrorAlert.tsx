import type { ReactNode } from 'react'
import { tintBorder } from '@/lib/tint'

// Server-side rejection alert (non-field 422 / other failure) shown in place while a
// create modal stays open — the ONE shared unit for this box (promoted from
// pages/customers/addmodal/CreateErrorAlert.tsx to components/forms/ so it can be
// imported outside customers — §2 barrel rule). Adopters: AddContactPersonModal,
// AddDepartmentModal, AddLocationModal, AddCustomerModal (inset 24), AddOpportunityModal
// and AddTaskModal (bottomGap 0 — those two pin a ModalFooter directly beneath).
// Ink is --color-on-danger-bg — the raw danger colour reads only 3.95:1 on its own
// pastel, an AA fail (Opus r3.5).
export default function CreateErrorAlert({
  message,
  children,
  inset = 22,
  bottomGap = 8,
}: {
  message?: string
  children?: ReactNode
  inset?: number
  bottomGap?: number
}) {
  return (
    <div
      role="alert"
      style={{
        margin: `0 ${inset}px ${bottomGap}px`,
        padding: '8px 10px',
        fontSize: 12,
        borderRadius: 8,
        color: 'var(--color-on-danger-bg)',
        background: 'var(--color-danger-bg)',
        border: tintBorder('var(--color-danger)', true),
        flexShrink: 0,
      }}
    >
      {children ?? message}
    </div>
  )
}
