/**
 * KeyValueField — the 'key_value' field kit citizen (a plain key->value record
 * control, e.g. shift_score's punten/klant_aanpassingen). GroupField (the
 * 'group' type) was removed with WA-MODULE point 19: after_send_updates was
 * its only registry consumer and no module declares a 'group' field any more.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { OnChange } from './fieldControls/types'
import CreatableSelect from '@/components/ui/CreatableSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { Caption } from '@/components/ui/typography'

// ── Key/value field ──────────────────────────────────────────────────────────────
// WA-SEND-FIELDS-2: whatsapp_send's `after_send_updates.conversation`/`.candidate`
// (WhatsAppSendModule::configSchema, type 'key_value') — the engine reads a PLAIN
// key->value RECORD (not the {name,value}[] array the unrelated 'keyvalue' field
// type in fields.tsx persists), so this writes/reads that record shape
// directly. The schema's `suggestions` (known key -> one value or a value list)
// render as pick-help via searchable selects; free entry stays allowed either way.
// One icon-only row-remove cell for both the committed rows and the pending
// draft — a single documented necessity exception instead of a copy per row.
export function RowRemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dense inline row-remove inside a ~26px input row; Button sm's fixed 28px footprint breaks the row height (§14 r7 necessity)
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0 4px', display: 'flex' }}>
      <X size={12} />
    </button>
  )
}

export function KeyValueField({ value, onChange, fieldKey, suggestions }: {
  value?: unknown; onChange: OnChange; fieldKey: string; suggestions?: Record<string, string | string[]>
}) {
  const { t } = useTranslation('workflows')
  const record = (value && typeof value === 'object' && !Array.isArray(value)) ? value as Record<string, string> : {}
  const rows = Object.entries(record)
  const knownKeys = Object.keys(suggestions ?? {})
  // The in-progress row lives in LOCAL state until it has a usable key: a plain
  // record cannot hold two empty keys, so persisting '' made a second Add a
  // silent no-op (audit). It commits into the record the moment a key lands.
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null)
  const isDuplicate = draft != null && draft.key !== '' && draft.key in record

  // Renames, updates and removes write the whole record back; a rename onto an
  // EXISTING key is refused (it would silently merge two rows - audit).
  const write     = (next: Record<string, string>) => onChange(fieldKey, next)
  const renameKey = (oldKey: string, newKey: string) => {
    if (newKey !== oldKey && newKey in record) return
    const next: Record<string, string> = {}
    for (const [k, v] of rows) next[k === oldKey ? newKey : k] = v
    write(next)
  }
  const updateValue = (k: string, v: string) => write({ ...record, [k]: v })
  const add          = () => { if (!draft) setDraft({ key: '', value: '' }) }
  const remove       = (k: string) => { const next = { ...record }; delete next[k]; write(next) }
  // Commit the draft once its key is non-empty and unique; else keep it pending.
  const commitDraft = (key: string, val: string) => {
    if (key !== '' && !(key in record)) { write({ ...record, [key]: val }); setDraft(null) }
    else setDraft({ key, value: val })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(([k, v], i) => {
        // A known key's own value suggestions (a single string or a list) render as options.
        const raw = suggestions?.[k]
        const valueChoices = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : [])
        return (
          <div key={i} style={{ display: 'flex', gap: 4 }}>
            <CreatableSelect value={k} onChange={nk => renameKey(k, nk)}
              options={knownKeys.map(kk => ({ value: kk, label: kk }))}
              placeholder={t('fields.keyName')} allowCreate
              style={{ flex: 1, padding: '5px 7px', fontSize: 12 }} />
            {valueChoices.length ? (
              <CreatableSelect value={v} onChange={nv => updateValue(k, nv)}
                options={valueChoices.map(vv => ({ value: vv, label: vv }))}
                placeholder={t('fields.keyValue')} allowCreate
                style={{ flex: 1, padding: '5px 7px', fontSize: 12 }} />
            ) : (
              <input value={v} onChange={e => updateValue(k, e.target.value)} placeholder={t('fields.keyValue')} aria-label={t('fields.keyValue')}
                style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            )}
            <RowRemoveButton onClick={() => remove(k)} label={t('common:remove')} />
          </div>
        )
      })}
      {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
      {draft && (
        <div style={{ display: 'flex', gap: 4 }}>
          <CreatableSelect value={draft.key || null} onChange={nk => commitDraft(nk, draft.value)}
            options={knownKeys.filter(kk => !(kk in record)).map(kk => ({ value: kk, label: kk }))}
            placeholder={t('fields.keyName')} allowCreate
            style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: isDuplicate ? '1px solid var(--color-danger)' : undefined }} />
          <input value={draft.value} onChange={e => setDraft({ key: draft.key, value: e.target.value })}
            placeholder={t('fields.keyValue')} aria-label={t('fields.keyValue')}
            style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
          <RowRemoveButton onClick={() => setDraft(null)} label={t('common:remove')} />
        </div>
      )}
      {/* A duplicate key never commits silently — say why the row stays pending. */}
      {isDuplicate && <Caption style={{ color: 'var(--color-danger-text)' }}>{t('fields.duplicateKey')}</Caption>}
      {/* One pending row at a time: the record cannot hold two empty keys. */}
      <DrawerAddButton onClick={add} label={t('fields.add')} disabled={!!draft} />
    </div>
  )
}
