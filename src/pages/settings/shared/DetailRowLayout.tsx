/**
 * DetailRowLayout — a flexible label/value row (or label/before/after diff row)
 * shared across audit drawer, detail panels, and other list displays. Handles
 * danger/success tinting, mono fonts, multi-line values, and error styling.
 */
import { ReactNode } from 'react'

interface DetailRowLayoutProps {
  label: string
  before?: unknown
  after?: unknown
  value?: unknown
  statusColor?: string
  statusBg?: string
  mono?: boolean
  error?: boolean
  gridTemplate?: string
  children?: ReactNode
}

// Single-value row (label | value).
export function DetailRow({ label, value, statusColor, statusBg, mono }: DetailRowLayoutProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--hover-bg)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: statusColor ?? 'var(--text)', background: statusBg,
                     borderRadius: statusBg ? 6 : 0, padding: statusBg ? '1px 7px' : 0,
                     fontFamily: mono ? 'monospace' : 'inherit', fontWeight: statusColor ? 700 : 400,
                     maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
        {String(value ?? '—')}
      </span>
    </div>
  )
}

// Three-column diff row (label | before | after).
export function DiffRow({ label, before, after }: DetailRowLayoutProps) {
  const changed = JSON.stringify(before) !== JSON.stringify(after)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 8,
                  padding: '7px 0', borderBottom: '1px solid var(--hover-bg)', alignItems: 'start' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ fontSize: 12, background: changed ? 'var(--color-danger-bg)' : 'var(--hover-bg)',
                    borderRadius: 6, padding: '3px 8px', color: changed ? 'var(--color-danger)' : 'var(--text-muted)',
                    wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        {Array.isArray(before) ? (before.length ? before.join(', ') : '—') : String(before ?? '—')}
      </div>
      <div style={{ fontSize: 12, background: changed ? 'var(--color-success-bg)' : 'var(--hover-bg)',
                    borderRadius: 6, padding: '3px 8px', color: changed ? 'var(--color-success)' : 'var(--text-muted)',
                    wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        {Array.isArray(after) ? (after.length ? after.join(', ') : '—') : String(after ?? '—')}
      </div>
    </div>
  )
}
