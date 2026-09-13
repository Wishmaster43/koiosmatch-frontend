import type { ReactNode } from 'react'
import { Caption } from '@/components/ui/typography'

// Two-sided EntityDrawer footer (§3A(8)): created-at left, empty right (consistent
// spacing with every other drawer's footer even when there is no right-side content).
export function EntityDrawerCreatedAtFooter({ createdAtLabel }: { createdAtLabel: ReactNode }) {
  return (
    <Caption as="div" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span>{createdAtLabel}</span>
      <span />
    </Caption>
  )
}
