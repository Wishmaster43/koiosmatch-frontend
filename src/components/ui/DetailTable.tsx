/**
 * DetailTable — read-only list of label/value rows.
 *
 * Replaces the repeated `[['Label', value], …].map(...)` blocks in the drawer
 * (matches, dienst-detail, inplanning, statistieken). Empty values show "-".
 *
 * CANON-DIVIDER-1 (2026-08-05): mirrors EditableFieldTable's own opt-in — a
 * caller that wants the candidate ProfileTab's calmer card look (no line
 * between rows, an 11px label) passes `dividers={false} labelFontSize={11}`;
 * both default to the ORIGINAL values so every existing caller (ApiKeyGeneralTab)
 * stays pixel-identical unless it explicitly opts in.
 */
import type { ReactNode } from 'react'
import { CANON_LABEL_WIDTH } from '@/components/drawer/fieldRowCanon'

interface DetailTableProps {
  rows?: Array<[label: string, value: ReactNode]>
  labelWidth?: number
  lastBorder?: boolean
  dividers?: boolean
  labelFontSize?: number
}

// CANON default (fieldRowCanon, Danny 05-08): was 130, aligned to the
// candidate ProfileTab's 120 — callers that genuinely need more document why.
export default function DetailTable({ rows = [], labelWidth = CANON_LABEL_WIDTH, lastBorder = true, dividers = false, labelFontSize = 11 }: DetailTableProps) {
  // Divider mode: the original full-bleed rows that own padding/background/borders.
  if (dividers) return (
    <>
      {rows.map(([label, value], i) => (
        <div key={label} style={{
          display: 'flex', gap: 16, padding: '9px 12px', background: 'var(--surface)',
          borderBottom: (lastBorder || i < rows.length - 1) ? '1px solid var(--border)' : 'none',
        }}>
          <span style={{ fontSize: labelFontSize, color: 'var(--text-muted)', width: labelWidth, flexShrink: 0 }}>{label}</span>
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{value || '-'}</span>
        </div>
      ))}
    </>
  )
  // CANON-BOX (05-08): calm default — one padded column with gap 2 and bare 26px
  // rows (28px pitch, the candidate canon). The BORDER stays with the caller's card.
  return (
    <div style={{ padding: '6px 12px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
          <span style={{ fontSize: labelFontSize, color: 'var(--text-muted)', width: labelWidth, flexShrink: 0 }}>{label}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text)' }}>{value || '-'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
