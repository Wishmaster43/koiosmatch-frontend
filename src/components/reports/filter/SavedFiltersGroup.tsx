/**
 * SavedFiltersGroup — the "saved filters" block inside the right filter panel
 * (type: 'saved-filters'). Generic: it reads its data + callbacks off the filter
 * group, so the persistence layer (localStorage today, backend later — SM-FILT-
 * SAVE) lives with the registrant, not here.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Trash2 } from 'lucide-react'
import type { ReportFilterGroup } from '@/types/reports'

// One saved set — state is opaque to this component.
interface SavedSet { id: string; name: string; state: unknown }

export default function SavedFiltersGroup({ group }: { group: ReportFilterGroup }) {
  const { t } = useTranslation('shiftmanager')
  const saved    = (group.saved as SavedSet[] | undefined) ?? []
  const onSave   = group.onSave   as ((name: string) => void) | undefined
  const onLoad   = group.onLoad   as ((state: unknown) => void) | undefined
  const onDelete = group.onDelete as ((id: string) => void) | undefined

  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Save the current selection; if no name yet, nudge the user to the input.
  const save = () => {
    if (!name.trim()) { inputRef.current?.focus(); return }
    onSave?.(name); setName('')
  }

  const input: React.CSSProperties = { flex: 1, minWidth: 0, height: 30, padding: '0 8px', fontSize: 12,
    border: '1px solid var(--border)', borderRadius: 6, background: 'var(--hover-bg)', color: 'var(--text)', outline: 'none' }

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.05em', marginBottom: 6 }}>
        {t('savedFilters.title')}
      </div>

      {/* Name + save */}
      <div style={{ display: 'flex', gap: 6, marginBottom: saved.length ? 8 : 0 }}>
        <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save() }}
          placeholder={t('savedFilters.namePlaceholder')} aria-label={t('savedFilters.namePlaceholder')}
          style={input} />
        <button type="button" onClick={save} title={t('savedFilters.save')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 10px', fontSize: 12, fontWeight: 500,
            border: 'none', borderRadius: 6, cursor: 'pointer', background: 'var(--color-primary)', color: 'var(--surface)' }}>
          <Save size={13} /> {t('savedFilters.save')}
        </button>
      </div>

      {/* Saved sets: click to load, trash to delete */}
      {saved.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <button type="button" onClick={() => onLoad?.(s.state)}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', height: 28, padding: '0 8px', fontSize: 12,
              border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
            {s.name}
          </button>
          <button type="button" onClick={() => onDelete?.(s.id)} title={t('savedFilters.delete')} aria-label={t('savedFilters.delete')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
              border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--color-danger)', cursor: 'pointer' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
