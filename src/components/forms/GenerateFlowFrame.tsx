/**
 * GenerateFlowFrame — the idle-entry-button + open-region-wrapper shared by
 * every "Genereer met Koios" create-form flow (ProfileGenerateFlow,
 * GenerateDescriptionFlow — DRY round 11). Only the header row inside the open
 * region differs per entity (candidate: close-only; vacancy: transparency
 * chip + close) — it travels in VERBATIM as a slot, never rebuilt here.
 */
import type { ReactNode } from 'react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import Button from '@/components/ui/Button'

interface GenerateFlowFrameProps {
  open: boolean
  onOpen: () => void
  canGenerate: boolean
  // Also the region's aria-label and the KoiosAiMark title — one resolved string, three uses.
  label: string
  disabledTitle: string
  header: ReactNode
  children: ReactNode
}

// Idle: the entry button. Open: the bordered region wrapper around the caller's own header + body.
export default function GenerateFlowFrame({ open, onOpen, canGenerate, label, disabledTitle, header, children }: GenerateFlowFrameProps) {
  if (!open) {
    return (
      <Button variant="soft" size="sm" onClick={onOpen} disabled={!canGenerate}
        aria-label={label} title={canGenerate ? undefined : disabledTitle}
        style={{ marginBottom: 8 }}>
        <KoiosAiMark size={16} tone="soft" title={label} />
        {label}
      </Button>
    )
  }

  return (
    <div role="region" aria-label={label}
      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8,
        background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {header}
      {children}
    </div>
  )
}
