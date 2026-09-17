/**
 * EntityListDrawer — generic slide-in panel that lists the records behind a KPI tile.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Caption } from '@/components/ui/typography'
import { DrawerListFooter } from '@/components/ui/DrawerListFooter'
import DrawerBackdrop from '@/components/drawer/DrawerBackdrop'
import DrawerHeaderRow from '@/components/drawer/DrawerHeaderRow'

interface EntityListItem {
  primary: string
  secondary?: string
  badge?: string
  badgeColor?: string
  badgeBg?: string
}

interface EntityListDrawerProps {
  title?: ReactNode
  items: EntityListItem[]
  onClose: () => void
}

// See the file's top doc above; a searchable slide-in list of the records behind one KPI tile.
export default function EntityListDrawer({ title, items, onClose }: EntityListDrawerProps) {
  const { t } = useTranslation('common')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const filtered = q
    ? items.filter(it =>
        (it.primary ?? '').toLowerCase().includes(q) ||
        (it.secondary ?? '').toLowerCase().includes(q)
      )
    : items

  return (
    <>
      <DrawerBackdrop onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
           className="fixed top-0 bottom-0 right-0 flex flex-col"
           // HUISSTIJL-1: aria-modal dialog panel — shadow-modal role.
           style={{ zIndex: 'var(--z-drawer)', width: 480, background: 'var(--surface)', boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header — DRY round 10, DRAWERSHELLS: shared via DrawerHeaderRow with
            ShiftsDrillDownDrawer (clone [6]). */}
        <DrawerHeaderRow title={title} onClose={onClose} closeAriaLabel={t('common:close')}
          meta={<div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('resultsCount', { count: items.length })}</div>} />

        {/* Search */}
        <div style={{ flexShrink: 0, padding: '8px 14px', borderBottom: '1px solid var(--hover-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                        background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: 7 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('search')} aria-label={t('search')}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                       fontSize: 12, color: 'var(--text)' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 120, fontSize: 13, color: 'var(--text-muted)' }}>
              {t('noResults')}
            </div>
          )}
          {filtered.map((item, i) => (
            <div key={i}
              style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)',
                       display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)',
                               whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.primary}
                </div>
                {item.secondary && (
                  <Caption as="div" style={{ marginTop: 2 }}>{item.secondary}</Caption>
                )}
              </div>
              {item.badge && (
                <span style={{ background: item.badgeBg ?? 'var(--hover-bg)', color: item.badgeColor ?? 'var(--text-muted)',
                               borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer — shared shown-of-count + close (§3, DrawerListFooter) */}
        <DrawerListFooter summary={t('shownOf', { shown: filtered.length, total: items.length })}
          onClose={onClose} closeLabel={t('close')} />
      </div>
    </>
  )
}
