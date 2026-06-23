/**
 * SettingsPage — the settings area shell. Two-level, registry-driven navigation:
 *
 *   [ category sidebar ]   ·   [ sub-tabs for that category ]   ·   [ section ]
 *
 * The sidebar lists the ~9 categories (groups) so it stays short as settings grow;
 * the items inside a category become sub-tabs. State is mirrored to the URL hash
 * (`#general/branding`) so sections are deep-linkable and the back button works.
 * A ⌘K palette searches every setting, and a dirty-guard warns before leaving a
 * section with unsaved changes.
 *
 * Everything is driven by ./registry.jsx — add a setting there (a `schema` for the
 * simple ones), no shell changes needed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { canAccessPage } from '../../lib/access'
import { NAV_GROUPS } from './registry'
import { SettingsDirtyContext } from './lib/settingsDirty'
import SettingItem from './components/SettingItem'
import SettingsTabs from './components/SettingsTabs'
import SettingsSearch from './components/SettingsSearch'

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '')
  const [category, tab] = raw.split('/')
  return category && tab ? { category, tab } : null
}

export default function SettingsPage() {
  const auth = useAuth()
  const { isSuperAdmin } = auth
  const { t } = useTranslation('settings')

  // Role/tenant gating + alphabetical sub-tabs (by translated label, language-aware).
  const visibleGroups = useMemo(() => NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items
        .filter(it => {
          if (it.superAdminOnly && !isSuperAdmin()) return false
          if (it.requiresPage && !canAccessPage(it.requiresPage, auth)) return false
          if (it.id === 'users' && !canAccessPage('users', auth)) return false
          return true
        })
        .sort((a, b) => t(`nav.${a.id}`).localeCompare(t(`nav.${b.id}`), undefined, { sensitivity: 'base' })),
    }))
    .filter(group => group.items.length > 0)
    // Sidebar categories alphabetical too (by translated group label).
    .sort((a, b) => t(`groups.${a.key}`).localeCompare(t(`groups.${b.key}`), undefined, { sensitivity: 'base' })),
    [auth, isSuperAdmin, t])

  const findLocation = (groupKey, tabId) => {
    const group = visibleGroups.find(g => g.key === groupKey)
    const item = group?.items.find(i => i.id === tabId)
    return group && item ? { category: group.key, tab: item.id } : null
  }

  // Initial location: a valid URL hash wins, else the first visible item.
  const initial = useMemo(() => {
    const fromHash = parseHash()
    if (fromHash && findLocation(fromHash.category, fromHash.tab)) return fromHash
    const first = visibleGroups[0]
    return first ? { category: first.key, tab: first.items[0].id } : { category: null, tab: null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [category, setCategory] = useState(initial.category)
  const [tab,      setTab]      = useState(initial.tab)
  const [searchOpen, setSearchOpen] = useState(false)

  // Dirty-guard: migrated sections report through this; we confirm before leaving.
  const dirtyRef = useRef(false)
  const dirtyCtx = useMemo(() => ({ report: (d) => { dirtyRef.current = d } }), [])
  const confirmLeave = () =>
    !dirtyRef.current || window.confirm(t('common.unsavedConfirm'))

  const goTo = (groupKey, tabId, { guard = true } = {}) => {
    if (guard && !confirmLeave()) return false
    dirtyRef.current = false
    setCategory(groupKey)
    setTab(tabId)
    return true
  }
  const selectCategory = (groupKey) => {
    const group = visibleGroups.find(g => g.key === groupKey)
    if (group) goTo(groupKey, group.items[0].id)
  }

  // If the active location is no longer visible for this role, fall back.
  useEffect(() => {
    if (!findLocation(category, tab)) {
      const first = visibleGroups[0]
      if (first) { setCategory(first.key); setTab(first.items[0].id) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleGroups])

  // Keep the URL hash in sync (deep-link / bookmark / back button).
  useEffect(() => {
    if (!category || !tab) return
    const next = `#${category}/${tab}`
    if (window.location.hash !== next) window.history.replaceState(null, '', next)
  }, [category, tab])

  useEffect(() => {
    const onHashChange = () => {
      const loc = parseHash()
      if (loc && findLocation(loc.category, loc.tab) && (loc.category !== category || loc.tab !== tab)) {
        goTo(loc.category, loc.tab, { guard: false })
      }
    }
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('keydown', onKey)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, tab])

  const currentGroup = visibleGroups.find(g => g.key === category)
  const currentItem  = currentGroup?.items.find(i => i.id === tab)

  return (
    <SettingsDirtyContext.Provider value={dirtyCtx}>
      <div className="flex h-full" style={{ minHeight: 0 }}>

        {/* ── Category sidebar (desktop) ── */}
        <div className="hidden md:flex" style={{
          flexDirection: 'column', width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
          background: 'var(--surface)', overflowY: 'auto', padding: '20px 12px',
        }}>
          <div style={{ padding: '0 8px', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('shell.title')}</div>
          </div>

          {/* Search trigger */}
          <button onClick={() => setSearchOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 34, padding: '0 10px',
            marginBottom: 16, border: '1px solid #EEF0F3', borderRadius: 9, background: 'var(--hover-bg)',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            <Search size={14} />
            <span style={{ fontSize: 13 }}>{t('shell.search')}</span>
            <kbd style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'inherit', color: '#C4C4CF' }}>⌘K</kbd>
          </button>

          {visibleGroups.map(group => {
            const Icon = group.icon
            const isActive = group.key === category
            return (
              <button key={group.key} onClick={() => selectCategory(group.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: isActive ? 600 : 500, textAlign: 'left', marginBottom: 2,
                  background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--text)', transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                {Icon && <Icon size={15} style={{ flexShrink: 0, color: isActive ? 'var(--color-primary)' : 'var(--text-muted)' }} />}
                {t(`groups.${group.key}`)}
              </button>
            )
          })}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 32, minWidth: 0 }}>
          {/* Mobile category selector (sidebar is hidden) */}
          {currentGroup && (
            <div className="md:hidden" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <select value={category} onChange={e => selectCategory(e.target.value)}
                style={{ flex: 1, height: 38, padding: '0 10px', fontSize: 14, border: '1px solid var(--border)',
                         borderRadius: 9, background: 'var(--surface)', color: 'var(--text)' }}>
                {visibleGroups.map(g => <option key={g.key} value={g.key}>{t(`groups.${g.key}`)}</option>)}
              </select>
              <button onClick={() => setSearchOpen(true)} aria-label={t('shell.search')}
                style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                         border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', cursor: 'pointer' }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          )}

          {!currentItem && (
            <div className="flex items-center justify-center" style={{ height: '60%' }}>
              <p className="text-sm text-[var(--text-muted)]">{t('shell.empty')}</p>
            </div>
          )}

          {currentItem && currentGroup && (
            <>
              <SettingsTabs items={currentGroup.items} active={tab}
                onSelect={(id) => goTo(category, id)} />
              <SettingItem key={`${category}/${tab}`} item={currentItem} />
            </>
          )}
        </div>

        <SettingsSearch open={searchOpen} onClose={() => setSearchOpen(false)}
          groups={visibleGroups} onSelect={(g, id) => goTo(g, id)} />
      </div>
    </SettingsDirtyContext.Provider>
  )
}
