import type { ReactNode } from 'react'

interface ModalHeaderIconBadgeProps {
  children: ReactNode
}

/**
 * ModalHeaderIconBadge — the 34x34 rounded primary-tint icon badge used in a
 * FloatingPanel's `header` slot (AddCustomerModal, AddOrderModal, …). Pure
 * layout: the caller passes its own lucide icon as children.
 */
export default function ModalHeaderIconBadge({ children }: ModalHeaderIconBadgeProps) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--color-primary-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  )
}
