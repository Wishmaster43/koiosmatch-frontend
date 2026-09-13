import type { ReactNode } from 'react'

interface ModalScrollBodyProps {
  children: ReactNode
}

/**
 * ModalScrollBody — the shared scroll area used by every FloatingPanel-based
 * add/edit modal that pins its own footer (DrawerAddApplicationModal,
 * PlanIntakeModal, MatchModal, …): fields scroll in their own region so the
 * footer buttons stay pinned and never clip (Danny 13-08). Pure layout, no
 * business logic — callers keep their own field markup as children.
 */
export default function ModalScrollBody({ children }: ModalScrollBodyProps) {
  return (
    <div style={{ overflow: 'auto', flex: 1, minHeight: 0, padding: 22 }}>
      {children}
    </div>
  )
}
