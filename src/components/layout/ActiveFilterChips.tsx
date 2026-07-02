/**
 * ActiveFilterChips — a single, generic "active filters" bar shown under the topbar.
 * It reads every filter group registered in RightPanelContext (the same source the
 * filter panel uses), so a dashboard jump (which seeds a page filter) becomes visible
 * and clearable on the target list — with zero per-page wiring. Self-hides when nothing
 * is active. Handles the list filter types (search-select / checkbox / global-search).
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'

// Loose shape of a registered filter group (varies per page; we read defensively).
interface Opt { value?: unknown; label?: string }
interface Group {
  key?: string; type?: string; label?: string
  selected?: unknown[]; options?: Opt[]; onToggle?: (v: unknown) => void
  value?: string; onChange?: (v: string) => void
}

export default function ActiveFilterChips() {
  const { t } = useTranslation('common')
  const { filterGroups } = useRightPanel() as unknown as { filterGroups: Group[] }

  // Flatten every active selection into a chip (label + a clear handler).
  const chips: Array<{ id: string; label: string; onClear: () => void }> = []
  for (const g of filterGroups) {
    if (Array.isArray(g.selected) && typeof g.onToggle === 'function') {
      for (const val of g.selected) {
        const opt = (g.options ?? []).find(o => String(o.value) === String(val))
        const valLabel = opt?.label ?? String(val)
        chips.push({ id: `${g.key}:${String(val)}`, label: g.label ? `${g.label}: ${valLabel}` : valLabel, onClear: () => g.onToggle!(val) })
      }
    } else if (g.type === 'global-search' && g.value && typeof g.onChange === 'function') {
      chips.push({ id: `${g.key}:search`, label: `${g.label ? g.label + ': ' : ''}"${g.value}"`, onClear: () => g.onChange!('') })
    }
  }

  if (chips.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 20px',
      borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('activeFilters')}</span>
      {chips.map(c => (
        <button key={c.id} onClick={c.onClear} aria-label={`${t('remove')}: ${c.label}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 8px 3px 10px', borderRadius: 999,
            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 34%, transparent)',
            color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}>
          {c.label}<X size={12} />
        </button>
      ))}
      {chips.length > 1 && (
        <button onClick={() => chips.forEach(c => c.onClear())}
          style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          {t('clearAll')}
        </button>
      )}
    </div>
  )
}
