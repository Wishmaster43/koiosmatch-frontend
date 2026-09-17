/**
 * RowField — shared read-mode field row (label left, value right).
 * Used across entity detail tabs for consistent field display.
 * D1: a thin alias over CanonFieldRow (same folder, same CANON_LABEL_STYLE) so
 * the label-left/value-right shape has one implementation; kept as its own
 * export because its two importers (tasks drawer) live outside this bucket.
 */
import type { ReactNode } from 'react'
import { CanonFieldRow } from '@/components/drawer/CanonFieldRow'

interface RowFieldProps {
  label: ReactNode
  children: ReactNode
}

// One read-mode row: delegates to CanonFieldRow's default center alignment.
export default function RowField({ label, children }: RowFieldProps) {
  return <CanonFieldRow label={label}>{children}</CanonFieldRow>
}
