/**
 * DashboardSwitcher — compact topbar dropdown to switch the dashboard view between
 * role templates (like the TenantSwitcher). Shown next to the profile avatar, only
 * when the user may see more than one view (super-admin + management see everything).
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ChevronDown } from 'lucide-react'
import type { DashboardType } from './templates'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'
import Button from '@/components/ui/Button'

export default function DashboardSwitcher({ value, options, onChange }: {
  value: DashboardType
  options: DashboardType[]
  onChange: (type: DashboardType) => void
}) {
  const { t } = useTranslation('dashboard')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on an outside click.
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (isInsideDropdownPortal(e.target as Node)) return; if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  if (options.length <= 1) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(o => !o)} aria-label={t('switcher.label')} title={t('switcher.label')}>
        <LayoutDashboard size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {t(`types.${value}`)}
        <ChevronDown size={13} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </Button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50, minWidth: 190,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', padding: 4 }}>
          {/* Dropdown menu options (active-dot indicator) — a list/menu item, not an
              action button, so this stays a bare <button>. */}
          {options.map(opt => {
            const active = opt === value
            return (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false) }} aria-pressed={active}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8,
                  padding: '8px 10px', fontSize: 12.5, borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'var(--color-primary-bg)' : 'transparent',
                  // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                  color: active ? 'var(--color-primary-text)' : 'var(--text)', fontWeight: active ? 600 : 400 }}>
                {t(`types.${opt}`)}
                {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
