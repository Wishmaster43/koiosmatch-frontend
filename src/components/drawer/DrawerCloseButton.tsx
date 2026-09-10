/**
 * DrawerCloseButton — shared ghost icon-only close button with hover styling.
 * Used in drawer header rows to close the panel.
 */
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'

interface DrawerCloseButtonProps {
  onClick: () => void
  ariaLabel: string
  style?: React.CSSProperties
}

// Close button with hover background — used across drawer headers.
export default function DrawerCloseButton({ onClick, ariaLabel, style }: DrawerCloseButtonProps) {
  return (
    <Button variant="ghost" iconOnly onClick={onClick} aria-label={ariaLabel}
      style={style}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      <X size={15} />
    </Button>
  )
}
