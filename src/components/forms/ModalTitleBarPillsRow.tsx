import type { ReactNode } from 'react'

interface ModalTitleBarPillsRowProps {
  title: ReactNode
  children: ReactNode
}

/**
 * ModalTitleBarPillsRow — the shared title-bar row for TITELBARPILLS
 * (Danny 27-08): the modal title plus its own TitleBarPills choice
 * (contract form, activity type, …) on the same line, used as a
 * FloatingPanel `header` (MatchModal, AddTaskModal, …). The caller passes
 * its own <TitleBarPills> as children so this stays pure layout.
 */
export default function ModalTitleBarPillsRow({ title, children }: ModalTitleBarPillsRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 100%' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{title}</div>
      {children}
    </div>
  )
}
