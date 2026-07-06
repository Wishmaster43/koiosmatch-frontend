/**
 * SavedFiltersBar — compact "save / load / delete" strip for ShiftManager filter
 * sets. Dumb: it renders controls and calls back; persistence lives in
 * useSavedShiftFilters (localStorage today, backend later — SM-FILT-SAVE).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Trash2 } from 'lucide-react'
import type { SavedShiftFilter, ShiftFilterState } from './useSavedShiftFilters'

export default function SavedFiltersBar({ saved, onSave, onLoad, onDelete }: {
  saved: SavedShiftFilter[]
  onSave: (name: string) => void
  onLoad: (state: ShiftFilterState) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation('shiftmanager')
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const control = { fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', outline: 'none' } as const

  // Load the chosen set (and remember it so it can be deleted).
  const handleSelect = (id: string) => {
    setSelectedId(id)
    const set = saved.find(s => s.id === id)
    if (set) onLoad(set.state)
  }

  const handleSave = () => { if (name.trim()) { onSave(name); setName('') } }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 12px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {t('savedFilters.title')}
      </span>

      {saved.length > 0 && (
        <>
          <select value={selectedId} onChange={e => handleSelect(e.target.value)} aria-label={t('savedFilters.load')}
            style={{ ...control, cursor: 'pointer' }}>
            <option value="">{t('savedFilters.load')}</option>
            {saved.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedId && (
            <button type="button" onClick={() => { onDelete(selectedId); setSelectedId('') }}
              title={t('savedFilters.delete')} aria-label={t('savedFilters.delete')}
              style={{ ...control, cursor: 'pointer', color: 'var(--color-danger)', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={13} />
            </button>
          )}
        </>
      )}

      <input value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        placeholder={t('savedFilters.namePlaceholder')} aria-label={t('savedFilters.namePlaceholder')}
        style={{ ...control, width: 150 }} />
      <button type="button" onClick={handleSave} disabled={!name.trim()}
        style={{ ...control, cursor: name.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 5,
          color: name.trim() ? 'var(--color-primary)' : 'var(--text-muted)' }}>
        <Save size={13} /> {t('savedFilters.save')}
      </button>
    </div>
  )
}
