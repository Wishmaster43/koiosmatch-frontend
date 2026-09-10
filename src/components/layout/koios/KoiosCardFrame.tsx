/**
 * KoiosCardFrame — the bordered surface + CollapsedCard disclosure chrome shared
 * by the Koios panel's top blocks (KoiosAssistantBlock, KoiosRadar): a title span,
 * a "filled" presence dot, a persisted open state and an optional close button.
 * Callers resolve their own title/close-label text via their own t() (§5 "one
 * source per label") and pass the resolved strings in — this unit owns layout only.
 * (DRY round 11, LAYOUT.)
 */
import type { ReactNode } from 'react'
import CollapsedCard from '@/components/ui/CollapsedCard'
import Button from '@/components/ui/Button'
import { X } from 'lucide-react'

export default function KoiosCardFrame({
  title, filled, open, onOpenChange, onClose, closeLabel, children,
}: {
  title: ReactNode
  filled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose?: () => void
  // Required alongside onClose — Button's iconOnly variant enforces a real
  // aria-label at the type level (§6), so a close button can never ship nameless.
  closeLabel: string
  children: ReactNode
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', padding: '10px 14px' }}>
      <CollapsedCard
        title={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</span>}
        filled={filled}
        open={open}
        onOpenChange={onOpenChange}
        action={onClose && (
          <Button variant="ghost" iconOnly size="sm" aria-label={closeLabel} title={closeLabel} onClick={onClose}>
            <X size={13} />
          </Button>
        )}
      >
        {children}
      </CollapsedCard>
    </div>
  )
}
