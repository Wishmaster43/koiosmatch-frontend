/**
 * BulkBarShell — the CHROME every entity's bulk-action bar shares: the tinted
 * container, the selection-count label and the trailing Deselect button. Every
 * entity's own `<Entity>BulkBar` stays a thin assembler over its own ActionMenu
 * config tree (§3A) — this component owns only what was copied byte-for-byte
 * across all seven of them, never the action tree itself.
 */
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import Button from './Button'
import { SectionTitle } from './typography'

interface BulkBarShellProps {
  /** The selection-count text (already translated by the caller) — e.g. t('bulk.selected', { count }). */
  label: ReactNode
  onClear: () => void
  /** Already-translated Deselect label — the caller owns its own namespace. */
  clearLabel: string
  /** The bar's own action controls (an ActionMenu, an extra toggle, a fallback notice, …), rendered between the label and Deselect. */
  children?: ReactNode
}

// The shared bulk-bar chrome: tinted container + count label + children (the
// caller's own action controls) + the Deselect button, in that order.
export default function BulkBarShell({ label, onClear, clearLabel, children }: BulkBarShellProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 12px', borderRadius: 8, background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary)' }}>
      {/* colour override: this bar sits on a tinted accent background */}
      <SectionTitle as="span" style={{ color: 'var(--color-primary-text)' }}>{label}</SectionTitle>

      {children}

      {/* Deselect: ghost keeps its identity except ink, which stays the accent
          text colour (this bar sits on a tinted accent background). */}
      <Button variant="ghostAccent" onClick={onClear} style={{ gap: 5, marginLeft: 'auto' }}>
        <X size={13} /> {clearLabel}
      </Button>
    </div>
  )
}
