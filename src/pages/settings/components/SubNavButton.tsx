import type { LucideIcon } from 'lucide-react'

// One left-sub-nav row: icon + label, active row tinted with the primary-text
// token (never the raw accent — P2b). Shared so a master-detail settings screen
// (Export, Import, …) never hand-rolls this row twice (DRY).
interface SubNavButtonProps {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
  ariaCurrent?: boolean
}

// Renders the row itself — active state tints background + text/icon colour.
export default function SubNavButton({ icon: Icon, label, active, onClick, ariaCurrent }: SubNavButtonProps) {
  return (
    <button type="button" onClick={onClick} aria-current={ariaCurrent ? 'true' : undefined}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
               borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
               fontWeight: active ? 600 : 400, marginBottom: 2,
               background: active ? 'var(--color-primary-bg)' : 'transparent',
               // Text/icon colour uses the AA-contrast primary-text token, not the raw accent (P2b).
               color: active ? 'var(--color-primary-text)' : 'var(--text)' }}>
      <Icon size={14} style={{ color: active ? 'var(--color-primary-text)' : 'var(--text-muted)', flexShrink: 0 }} />
      {label}
    </button>
  )
}
