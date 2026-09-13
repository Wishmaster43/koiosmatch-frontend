import type { ReactNode } from 'react'
import { cardHead } from '@/components/ui/modalCards'

interface CardHeaderWithAddTriggerProps {
  title: ReactNode
  children: ReactNode
}

/**
 * CardHeaderWithAddTrigger — the shared "card title left, add trigger right"
 * header row (BranchesCard, CustomerBranchesCard, …): the trigger sits
 * OUTSIDE the card body next to the heading, drill-down parity (Danny r2).
 */
export default function CardHeaderWithAddTrigger({ title, children }: CardHeaderWithAddTriggerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
      <div style={{ ...cardHead, marginBottom: 0 }}>{title}</div>
      {children}
    </div>
  )
}
