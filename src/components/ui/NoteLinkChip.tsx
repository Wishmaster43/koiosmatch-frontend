/**
 * NoteLinkChip — the small tinted pill a note row shows in place of its
 * (never-persisted) title when the note is linked to a location/department/
 * contact — shared by the customer notes tab and its second-screen popout so
 * the read-parity look never drifts between the two surfaces.
 */
import type { ReactNode } from 'react'
import { tintBg, tintBorder } from '@/lib/tint'

export function NoteLinkChip({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 600,
      padding: '1px 6px', borderRadius: 99, marginRight: 6,
      background: tintBg('var(--color-info)'), color: 'var(--color-info)',
      border: tintBorder('var(--color-info)') }}>
      {children}
    </span>
  )
}
