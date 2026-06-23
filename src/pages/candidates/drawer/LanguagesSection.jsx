import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Plus, Trash2 } from 'lucide-react'
import { useLanguageLookups } from '../../../lib/useLanguageLookups'

/**
 * LanguagesSection — the candidate's languages, fully editable (add / change /
 * remove) with dropdowns for taal + gesproken/schriftelijk niveau. Options come
 * from the tenant-configurable lists (Settings → Talen) with a package default.
 * Same in-place pencil ↔ save/cancel pattern as the profile blocks.
 */
export default function LanguagesSection({ c, onEditSave }) {
  const { t } = useTranslation('candidates')
  const { languages: langOpts, levels } = useLanguageLookups()

  const initial = () => (c.languages ?? []).map(l => ({
    language: l.language ?? l.name ?? '', spoken: l.spoken ?? '', written: l.written ?? '',
  }))
  const [editing, setEditing] = useState(false)
  const [rows,    setRows]    = useState(initial)

  const setRow    = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const addRow    = ()        => setRows(r => [...r, { language: '', spoken: '', written: '' }])
  const removeRow = (i)       => setRows(r => r.filter((_, idx) => idx !== i))
  const save   = () => { onEditSave?.({ languages: rows.filter(r => r.language) }); setEditing(false) }
  const cancel = () => { setRows(initial()); setEditing(false) }

  const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
  const selectStyle = { flex: 1, minWidth: 0, padding: '6px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
  const view = c.languages ?? []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('sections.languages')}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
            <button onClick={cancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => { setRows(initial()); setEditing(true) }} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
        )}
      </div>

      <div style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', padding: '10px 12px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={row.language} onChange={e => setRow(i, 'language', e.target.value)} style={selectStyle}>
                  <option value="">{t('addFields.language')}</option>
                  {langOpts.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={row.spoken} onChange={e => setRow(i, 'spoken', e.target.value)} style={selectStyle}>
                  <option value="">{t('addFields.spokenLevel')}</option>
                  {levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <select value={row.written} onChange={e => setRow(i, 'written', e.target.value)} style={selectStyle}>
                  <option value="">{t('addFields.writtenLevel')}</option>
                  {levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={() => removeRow(i)} title={t('common:remove', { defaultValue: 'Verwijderen' })}
                  style={{ ...iconBtn, flexShrink: 0, background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: 'none' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button onClick={addRow}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 11, fontWeight: 500,
                border: '1px dashed var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', alignSelf: 'flex-start' }}>
              <Plus size={11} /> {t('addFields.language')}
            </button>
          </div>
        ) : view.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.languagesEmpty')}</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {view.map((l, i) => (
              <span key={l.id ?? i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                {l.language ?? l.name}{l.spoken ? ` · ${l.spoken}` : ''}{l.written ? ` · ${l.written}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
