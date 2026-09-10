// OwnerCell — the standard "avatar + name" owner/assignee table cell, with an
// optional muted "bureau" fallback (icon bubble + label) when there is no owner.
// Shared by ApplicationsTable (always passes a resolved owner, so the fallback
// branch never triggers) and TasksTable (passes null when there is no assignee,
// DRY round 11, PAGES). The colour and the fallback label arrive pre-resolved so
// this stays a dumb presentational cell (§3, no tenant setting or i18n inside it).
import type { ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { tint } from '@/lib/tint'

// Same 22px footprint as the Avatar so the cell never jumps between an
// avatar-shaped and a bare-text look (moved from TasksTable, Danny 2026-07-14:
// the tasks resource has no location/branch on the list row yet — BE gap).
// tint() (not tintBg/tintBorder's house 10/33 pair) keeps the exact pre-existing
// 12%/40% mix so the move carries zero visible change (§4, DRY round 11).
const bureauBubble = { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, background: tint('var(--text-muted)', 12),
  border: `1px solid ${tint('var(--text-muted)', 40)}` }

export interface OwnerCellOwner {
  initials?: string
  name?: ReactNode
  color?: string | null
}

export interface OwnerCellProps {
  // Absent/null owner renders the fallback (when one is given) instead of a blank avatar.
  owner?: OwnerCellOwner | null
  // Resolved "bureau" text (already translated by the consumer's own t()) — the
  // icon-bubble fallback only renders when this is given AND owner is absent.
  fallbackLabel?: ReactNode
}

export default function OwnerCell({ owner, fallbackLabel }: OwnerCellProps) {
  if (!owner && fallbackLabel != null) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={bureauBubble}><Building2 size={12} style={{ color: 'var(--text-muted)' }} /></span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fallbackLabel}</span>
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Avatar initials={owner?.initials} size={22} color={owner?.color} soft />
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{owner?.name}</span>
    </span>
  )
}
