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
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useApps } from '@/context/AppsContext'
import { canAccessPage } from '@/lib/access'
import { useConfirm } from '@/hooks/useConfirm'
import { NAV_GROUPS } from './registry'
import { SettingsDirtyContext } from './lib/settingsDirty'
import SettingItem from './components/SettingItem'
import SettingsTabs from './components/SettingsTabs'
import SettingsSearch from './components/SettingsSearch'
import SettingsChangelogButton from './components/SettingsChangelogButton'
// THE RULE (Danny 08-08, §4): searchable dropdown everywhere, no exceptions for
// short lists — replaces the mobile category native <select> below.
import SelectMenu from '@/components/ui/SelectMenu'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/typography'

// SM-MODULE-TABS-1: a nav item may declare `requiresModuleOrApp: { module, app }` to
// stay visible when EITHER the tenant module OR the app/koppeling flag is on (a plain
// `requiresPage` ANDs on the module only — see lib/access.ts). Exported as a pure
// function so the module/app/both/neither matrix is unit-testable without mounting
// the whole registry-driven shell.
// eslint-disable-next-line react-refresh/only-export-components -- pure predicate exported for unit tests + a sibling settings section (ShiftmanagerModuleSettings); relocating would touch three unrelated files
export function passesModuleOrApp(requirement, { hasModule, isAppEnabled }) {
  if (!requirement) return true
  const { module, app } = requirement
  const moduleOn = module ? hasModule(module) : false
  const appOn = app && isAppEnabled ? isAppEnabled(app) : false
  return moduleOn || appOn
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '')
  const parts = raw.split('/')
  // Canonical form is #settings/<category>/<tab> — the prefix keeps settings deep-links
  // from colliding with page hashes (#applications/… booted the Applications LIST).
  // The legacy unprefixed #<category>/<tab> is still accepted for old bookmarks.
  const [category, tab] = parts[0] === 'settings' ? parts.slice(1) : parts
  return category && tab ? { category, tab } : null
}

export default function SettingsPage() {
  const auth = useAuth()
  const { isSuperAdmin, hasModule, hasPermission } = auth
  const { t } = useTranslation('settings')
  // Shiftmanager settings (SM-MODULE-TABS-1) reads the app/koppeling flag from
  // AppsContext — a nav item may declare requiresModuleOrApp to be visible on
  // EITHER signal (a plain requiresPage ANDs on the module only). isAppEnabled is
  // re-created by AppsProvider whenever its enabled-list changes, so it alone is
  // enough to invalidate the memo below — no separate `enabled` dependency needed.
  const { isAppEnabled } = useApps() ?? {}

  // Role/tenant gating + alphabetical sub-tabs (by translated label, language-aware).
  const visibleGroups = useMemo(() => NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items
        .filter(it => {
          if (it.superAdminOnly && !isSuperAdmin()) return false
          if (it.requiresPage && !canAccessPage(it.requiresPage, auth)) return false
          if (it.requiresModuleOrApp && !passesModuleOrApp(it.requiresModuleOrApp, { hasModule, isAppEnabled })) return false
          // CREDITS-1: a nav item may declare `requiresPermission` — a bare user/role
          // permission check (billing.view et al), independent of the page/module axes
          // above. Hidden, never disabled (§3) — settings.view alone must not surface it.
          if (it.requiresPermission && !hasPermission(it.requiresPermission)) return false
          if (it.id === 'users' && !canAccessPage('users', auth)) return false
          return true
        })
        .sort((a, b) => t(`nav.${a.id}`).localeCompare(t(`nav.${b.id}`), undefined, { sensitivity: 'base' })),
    }))
    .filter(group => group.items.length > 0)
    // Sidebar categories alphabetical too (by translated group label).
    .sort((a, b) => t(`groups.${a.key}`).localeCompare(t(`groups.${b.key}`), undefined, { sensitivity: 'base' })),
    [auth, isSuperAdmin, hasModule, hasPermission, isAppEnabled, t])

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
  // Names the mobile category SelectMenu (its trigger is a <button>, not labelable
  // via htmlFor/aria-label — see SelectMenu's own doc comment) via a sr-only span.
  const categoryPickerLabelId = useId()

  // Dirty-guard: migrated sections report through this; we confirm before leaving.
  const dirtyRef = useRef(false)
  const dirtyCtx = useMemo(() => ({ report: (d) => { dirtyRef.current = d } }), [])
  const { confirm, dialog } = useConfirm()

  // Apply the actual navigation — shared by the guarded and unguarded paths.
  const applyNav = (groupKey, tabId) => {
    dirtyRef.current = false
    setCategory(groupKey)
    setTab(tabId)
  }

  const goTo = (groupKey, tabId, { guard = true } = {}) => {
    if (guard && dirtyRef.current) {
      confirm(t('common.unsavedConfirm'), () => applyNav(groupKey, tabId))
      return false
    }
    applyNav(groupKey, tabId)
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
    const next = `#settings/${category}/${tab}`
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
            <PageTitle style={{ fontWeight: 700 }}>{t('shell.title')}</PageTitle>
          </div>

          {/* Search trigger */}
          {/* Audit finding (§4/§10): the hairline border here is now the standard --border
              token (close enough to the old #EEF0F3 to be indistinguishable — no need for a
              literal). The ⌘K hint stays a literal: it is deliberately lighter than
              --text-muted (a barely-there shortcut hint, not body text) and no existing
              token sits that light — kept as documented DATA-adjacent chrome. */}
          <button onClick={() => setSearchOpen(true)}
            // eslint-disable-next-line huisstijl/no-restricted-syntax, huisstijlLegacy/no-restricted-syntax -- the search-trigger bar, styled to the 34px search-chrome height Button's own docs carve out (§4), not a text/action Button copy
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 34, padding: '0 10px',
            marginBottom: 16, border: '1px solid var(--border)', borderRadius: 9, background: 'var(--hover-bg)',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            <Search size={14} />
            <span style={{ fontSize: 13 }}>{t('shell.search')}</span>
            {/* eslint-disable-next-line no-restricted-syntax -- no --text-muted-adjacent token this light exists; a barely-there ⌘K hint, kept literal on purpose (see comment above) */}
            <kbd style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'inherit', color: '#C4C4CF' }}>⌘K</kbd>
          </button>

          {visibleGroups.map(group => {
            const Icon = group.icon
            const isActive = group.key === category
            return (
              <button key={group.key} onClick={() => selectCategory(group.key)}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- resting sidebar navigation item (§4: active nav is a tint/place-marker, not an action), not a Button
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: isActive ? 600 : 500, textAlign: 'left', marginBottom: 2,
                  background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                  // Active label uses the READABLE accent variant — a light brand
                  // (yellow) would otherwise print accent-on-accent-tint (Danny 08-08).
                  color: isActive ? 'var(--color-primary-text)' : 'var(--text)', transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                {Icon && <Icon size={15} style={{ flexShrink: 0, color: isActive ? 'var(--color-primary-text)' : 'var(--text-muted)' }} />}
                {t(`groups.${group.key}`)}
              </button>
            )
          })}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 32, minWidth: 0 }}>
          {/* Mobile category selector (sidebar is hidden). PREVIOUSLY a deliberate native
              <select> (the OS's own full-height picker sheet beats a popover on touch) —
              superseded by Danny's emphatic 08-08 rule (§4): ALWAYS a searchable dropdown,
              no exceptions for short lists. Desktop keeps the real sidebar (above) and
              never sees this control. */}
          {currentGroup && (
            <div className="md:hidden" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <span id={categoryPickerLabelId} className="sr-only">{t('shell.categoryPicker')}</span>
              <SelectMenu aria-labelledby={categoryPickerLabelId} value={category} onChange={selectCategory}
                options={visibleGroups.map(g => ({ value: g.key, label: t(`groups.${g.key}`) }))}
                style={{ flex: 1, height: 38, fontSize: 14 }} />
              <Button variant="secondary" iconOnly onClick={() => setSearchOpen(true)} aria-label={t('shell.search')}
                style={{ width: 38, height: 38 }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
              </Button>
            </div>
          )}

          {!currentItem && (
            <div className="flex items-center justify-center" style={{ height: '60%' }}>
              <p className="text-sm text-[var(--text-muted)]">{t('shell.empty')}</p>
            </div>
          )}

          {currentItem && currentGroup && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: -8 }}>
                <SettingsChangelogButton />
              </div>
              <SettingsTabs items={currentGroup.items} active={tab}
                onSelect={(id) => goTo(category, id)} />
              <SettingItem key={`${category}/${tab}`} item={currentItem} />
            </>
          )}
        </div>

        <SettingsSearch open={searchOpen} onClose={() => setSearchOpen(false)}
          groups={visibleGroups} onSelect={(g, id) => goTo(g, id)} />
        {dialog}
      </div>
    </SettingsDirtyContext.Provider>
  )
}
