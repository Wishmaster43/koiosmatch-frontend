/**
 * FunctionMatrixField — shift_score's `functie_matrix` (field type 'function_matrix').
 * Rows of position name + primary functions + secondary functions (comma separated),
 * persisted as the backend's nested record { [position]: { primary: string[],
 * secondary: string[] } } (ShiftScoreModule reads `$functieMatrix[$positie]`, keys
 * lower-case). Mirrors KeyValueField's pending-draft idiom: a new row stays a draft
 * until its position is non-empty and unique, then commits on Enter or when focus
 * leaves the row.
 */
import { useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { OnChange } from './types'
import { RowRemoveButton } from '../groupKeyValueFields'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { Caption } from '@/components/ui/typography'

type MatrixEntry = { primary: string[]; secondary: string[] }
type Draft = { position: string; primary: string; secondary: string }

// One dense input face for every cell (same metrics as the sibling key/value rows).
const CELL: CSSProperties = { padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }

// Comma-separated list → trimmed, lower-cased, non-empty function names.
const parseList = (input: string): string[] => input.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const formatList = (list: string[] | undefined): string => (list ?? []).join(', ')

export function FunctionMatrixField({ value, onChange, fieldKey }: {
  value?: unknown; onChange: OnChange; fieldKey: string
}) {
  const { t } = useTranslation('workflows')
  const record = (value && typeof value === 'object' && !Array.isArray(value)) ? value as Record<string, MatrixEntry> : {}
  const rows = Object.entries(record)
  const [draft, setDraft] = useState<Draft | null>(null)
  const draftKey = draft?.position.trim().toLowerCase() ?? ''
  const isDuplicate = draft != null && draftKey !== '' && draftKey in record

  const write = (next: Record<string, MatrixEntry>) => onChange(fieldKey, next)
  // Rename a committed position; a rename onto an existing key would silently merge two rows, so it is refused.
  const renamePosition = (oldPos: string, newPos: string) => {
    if (newPos !== oldPos && newPos in record) return
    const next: Record<string, MatrixEntry> = {}
    for (const [k, v] of rows) next[k === oldPos ? newPos : k] = v
    write(next)
  }
  const updateLists = (position: string, primary: string[], secondary: string[]) => write({ ...record, [position]: { primary, secondary } })
  const remove = (position: string) => { const next = { ...record }; delete next[position]; write(next) }
  const add = () => { if (!draft) setDraft({ position: '', primary: '', secondary: '' }) }

  // Commit the draft once its position is non-empty and unique; else it stays pending.
  const commitDraft = () => {
    if (!draft || draftKey === '' || isDuplicate) return
    write({ ...record, [draftKey]: { primary: parseList(draft.primary), secondary: parseList(draft.secondary) } })
    setDraft(null)
  }
  const onDraftBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitDraft()
  }
  const onDraftKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitDraft() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(([position, entry]) => (
        <div key={position} style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          <input value={position} onChange={e => renamePosition(position, e.target.value)}
            placeholder={t('fields.functionPosition')} aria-label={t('fields.functionPosition')} style={{ ...CELL, flex: 0.8 }} />
          <input value={formatList(entry.primary)} onChange={e => updateLists(position, parseList(e.target.value), entry.secondary ?? [])}
            placeholder={t('fields.functionPrimary')} aria-label={t('fields.functionPrimary')} style={{ ...CELL, flex: 1 }} />
          <input value={formatList(entry.secondary)} onChange={e => updateLists(position, entry.primary ?? [], parseList(e.target.value))}
            placeholder={t('fields.functionSecondary')} aria-label={t('fields.functionSecondary')} style={{ ...CELL, flex: 1 }} />
          <RowRemoveButton onClick={() => remove(position)} label={t('common:remove')} />
        </div>
      ))}
      {draft && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }} onBlur={onDraftBlur} onKeyDown={onDraftKeyDown}>
          <input value={draft.position} onChange={e => setDraft({ ...draft, position: e.target.value })} autoFocus
            placeholder={t('fields.functionPosition')} aria-label={t('fields.functionPosition')}
            style={{ ...CELL, flex: 0.8, borderColor: isDuplicate ? 'var(--color-danger)' : 'var(--border)' }} />
          <input value={draft.primary} onChange={e => setDraft({ ...draft, primary: e.target.value })}
            placeholder={t('fields.functionPrimary')} aria-label={t('fields.functionPrimary')} style={{ ...CELL, flex: 1 }} />
          <input value={draft.secondary} onChange={e => setDraft({ ...draft, secondary: e.target.value })}
            placeholder={t('fields.functionSecondary')} aria-label={t('fields.functionSecondary')} style={{ ...CELL, flex: 1 }} />
          <RowRemoveButton onClick={() => setDraft(null)} label={t('common:remove')} />
        </div>
      )}
      {/* A duplicate position never commits silently: say why the row stays pending. */}
      {isDuplicate && <Caption style={{ color: 'var(--color-danger-text)' }}>{t('fields.duplicateKey')}</Caption>}
      <DrawerAddButton onClick={add} label={t('fields.add')} disabled={!!draft} />
    </div>
  )
}
