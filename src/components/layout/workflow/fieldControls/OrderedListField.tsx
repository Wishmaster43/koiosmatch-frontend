/**
 * Ordered-list field — WA-SEND-FIELDS-2: whatsapp_send's `body_parameters`
 * (WhatsAppSendModule::configSchema, type 'ordered_list') — an ORDER-sensitive
 * list of {value} rows (a WhatsApp Flow's positional {{1}}, {{2}}, …), so
 * reordering is a real affordance here, unlike the unordered 'keyvalue' field.
 * Split out of fieldControls/ (§3 400-line split trigger).
 */
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Caption, Mono } from '@/components/ui/typography'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import type { OnChange } from './types'

// ── Ordered-list field ──────────────────────────────────────────────────────────
export function OrderedListField({ value, onChange, fieldKey }: { value?: unknown; onChange: OnChange; fieldKey: string }) {
  const { t } = useTranslation('workflows')
  const rows = (Array.isArray(value) ? value : []) as Array<{ value?: string }>

  // Update, add, remove and reorder one row of the ordered list, always writing the whole array back.
  const update = (i: number, v: string) => onChange(fieldKey, rows.map((r, j) => j === i ? { ...r, value: v } : r))
  const add    = () => onChange(fieldKey, [...rows, { value: '' }])
  const remove = (i: number) => onChange(fieldKey, rows.filter((_, j) => j !== i))
  const move   = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(fieldKey, next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Caption as="span" style={{ width: 16, textAlign: 'right' }}><Mono>{i + 1}</Mono></Caption>
          <input value={r.value ?? ''} onChange={e => update(i, e.target.value)} placeholder="{{firstname}}" aria-label={t('fields.keyValue')}
            style={{ flex: 1, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('fields.moveUp')} title={t('fields.moveUp')}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dense inline reorder control inside a ~26px row; Button sm's fixed 28px footprint breaks the row height (§14 r7 necessity)
            style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--border)' : 'var(--text-muted)', padding: '0 2px', display: 'flex' }}>
            <ChevronUp size={12} />
          </button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={t('fields.moveDown')} title={t('fields.moveDown')}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dense inline reorder control inside a ~26px row; Button sm's fixed 28px footprint breaks the row height (§14 r7 necessity)
            style={{ background: 'none', border: 'none', cursor: i === rows.length - 1 ? 'default' : 'pointer', color: i === rows.length - 1 ? 'var(--border)' : 'var(--text-muted)', padding: '0 2px', display: 'flex' }}>
            <ChevronDown size={12} />
          </button>
          <button type="button" onClick={() => remove(i)} aria-label={t('common:remove')} title={t('common:remove')}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dense inline row-remove inside a ~26px input row; Button sm's fixed 28px footprint breaks the row height (§14 r7 necessity)
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0 4px' }}>
            <X size={12} />
          </button>
        </div>
      ))}
      {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
      <DrawerAddButton onClick={add} label={t('fields.add')} />
    </div>
  )
}
