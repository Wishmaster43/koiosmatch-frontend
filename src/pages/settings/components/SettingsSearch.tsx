/**
 * SettingsSearch — the ⌘K command palette over the settings.
 *
 * The index is built automatically from the visible registry items (every
 * category and every sub-tab), enriched with translated synonyms, and matched on
 * a normalised form so hyphens, accents and casing never hide a screen
 * ("email" === "e-mail"). Index + matcher live in settingsSearchIndex.ts;
 * this file only renders and handles keyboard/mouse selection.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, CornerDownLeft } from 'lucide-react'
import {
  buildSettingsSearchEntries,
  filterSettingsSearchEntries,
  type SettingsNavGroup,
  type SettingsTranslate,
} from './settingsSearchIndex'

/** Props: the palette is fully controlled by the settings page. */
interface SettingsSearchProps {
  open: boolean
  onClose: () => void
  groups: SettingsNavGroup[]
  onSelect: (groupKey: string, id: string) => void
}

const LISTBOX_ID = 'settings-search-results'

export default function SettingsSearch({ open, onClose, groups, onSelect }: SettingsSearchProps) {
  // Two namespaces: `settings` for the visible labels, `settingsSearch` for the synonyms.
  const { t } = useTranslation(['settings', 'settingsSearch'])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Rebuild the searchable index whenever the visible registry or the language changes.
  const entries = useMemo(
    () => buildSettingsSearchEntries(groups, t as SettingsTranslate),
    [groups, t],
  )

  // Normalised, ranked matching — see settingsSearchIndex.ts for the why.
  const results = useMemo(() => filterSettingsSearchEntries(entries, query), [entries, query])

  // Reset the highlight on every new query so Enter never picks a stale row.
  useEffect(() => { setActive(0) }, [query])

  // Open with an empty query and the caret in the field.
  useEffect(() => {
    if (!open) return
    setQuery('')
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(focusTimer)
  }, [open])

  // Keep the keyboard-highlighted row inside the scroll viewport (guarded: jsdom
  // and older engines do not implement scrollIntoView, and this is cosmetic).
  useEffect(() => { activeRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [active])

  if (!open) return null

  // Jump to the picked category + tab and close the palette.
  const choose = (entry?: { groupKey: string; id: string }) => {
    if (!entry) return
    onSelect(entry.groupKey, entry.id)
    onClose()
  }

  // Full keyboard operability: arrows move, Enter picks, Escape closes (§6).
  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (ev.key === 'Enter') { ev.preventDefault(); choose(results[active]) }
    else if (ev.key === 'Escape') { ev.preventDefault(); onClose() }
  }

  return (
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(17,24,39,0.35)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
    }}>
      <div role="dialog" aria-modal="true" aria-label={t('shell.search')}
        onMouseDown={e => e.stopPropagation()} style={{
          width: 'min(560px, 92vw)', background: 'var(--surface)', borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}>
        {/* Query field — the only focus stop; the list is driven from here. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder={t('shell.search')} aria-label={t('shell.search')}
            role="combobox" aria-expanded aria-controls={LISTBOX_ID}
            aria-activedescendant={results[active] ? `${LISTBOX_ID}-${active}` : undefined}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: 'var(--text)', background: 'transparent' }} />
        </div>

        <div id={LISTBOX_ID} role="listbox" aria-label={t('shell.title')}
          style={{ maxHeight: '50vh', overflowY: 'auto', padding: 6 }}>
          {/* Two honest empty states: nothing available for this role vs. nothing matched. */}
          {results.length === 0 && (
            <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              {entries.length === 0 ? t('shell.empty') : t('shell.noResults')}
            </div>
          )}
          {results.map((entry, i) => {
            const Icon = entry.icon
            const isActive = i === active
            return (
              <button key={`${entry.groupKey}/${entry.id}`} id={`${LISTBOX_ID}-${i}`}
                ref={isActive ? activeRef : undefined}
                role="option" aria-selected={isActive} tabIndex={-1}
                onMouseEnter={() => setActive(i)} onClick={() => choose(entry)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                }}>
                {/* Text-colour accent uses the AA-contrast text token, not the raw brand primary. */}
                {Icon && <Icon size={15} style={{ flexShrink: 0, color: isActive ? 'var(--color-primary-text)' : 'var(--text-muted)' }} aria-hidden="true" />}
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{entry.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{entry.group}</span>
                {isActive && <CornerDownLeft size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
