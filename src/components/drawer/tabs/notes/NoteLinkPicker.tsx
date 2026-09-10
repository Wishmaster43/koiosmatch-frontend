/**
 * NoteLinkPicker — the "pick a stamdata type, then pick a record" row for the
 * manual koppel-picker on ONE note (NOTITIE-DOORLINK-1 write side). Mirrors
 * pages/tasks/links/AddLinkRow.tsx's shape (server-searched capped fetch, same
 * error+retry line) — not imported from there: the barrel rule (§2) keeps that
 * file private to the tasks feature, and this picker's own vocabulary is a
 * smaller, different table (5 principal tokens, see noteLinksApi's docblock).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import Button from '@/components/ui/Button'
import SelectMenu from '@/components/ui/SelectMenu'
import SearchSelect from '@/components/ui/SearchSelect'
import FieldNotice from '@/components/ui/FieldNotice'
import Spinner from '@/components/ui/Spinner'
import type { NoteLinkItem, NoteLinkPrincipalType } from './noteLinksApi'
import { PRINCIPAL_ENDPOINTS, PRINCIPAL_TYPES, type PickerRow } from './noteLinkPickerHelpers'
import type { Id } from '@/types/common'

export default function NoteLinkPicker({ existing, onAdd, onClose, busy }: {
  // Already-linked principals on this note — filtered out of the entity list per type.
  existing: NoteLinkItem[]
  onAdd: (sel: { type: NoteLinkPrincipalType; id: Id; label: string }) => void
  onClose: () => void
  // The add call is in flight — disables the picker's own trigger, never a second click.
  busy: boolean
}) {
  const { t } = useTranslation('common')
  const [type, setType] = useState<NoteLinkPrincipalType>('candidate')
  const [rows, setRows] = useState<PickerRow[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState(false)
  // Freshness guard (mirrors AddLinkRow): the retry button can re-run this exact
  // fetch without a stale in-flight response overwriting a newer one.
  const requestIdRef = useRef(0)

  // Load a capped, server-searched page for the chosen type — never the whole table.
  const fetchOptions = useCallback(() => {
    const cfg = PRINCIPAL_ENDPOINTS[type]
    const requestId = ++requestIdRef.current
    setError(false)
    // An empty query must send NEITHER q nor search — several PRINCIPAL_ENDPOINTS
    // (customers, customer-locations, departments, contacts) 422 on a null value
    // from a plain empty string (contract audit ENT2-01, same fix as AddLinkRow).
    api.get(cfg.url, { params: { ...(query ? { q: query, search: query } : {}), per_page: 25 } })
      .then(r => { if (requestIdRef.current === requestId) setRows(unwrapList<PickerRow>(r).rows) })
      .catch(() => { if (requestIdRef.current === requestId) setError(true) })
  }, [type, query])
  // Re-runs on type/query change, clearing stale rows first so the previous type's options never flash.
  useEffect(() => { setRows([]); fetchOptions() }, [fetchOptions])

  const cfg = PRINCIPAL_ENDPOINTS[type]
  const linkedIds = new Set(existing.filter(l => l.linkable_type === type).map(l => String(l.linkable_id)))
  const options = rows.filter(r => !linkedIds.has(String(r.id))).map(r => ({ value: String(r.id), label: cfg.label(r) }))
  const typeOptions = PRINCIPAL_TYPES.map(k => ({ value: k, label: t(`notes.links.type.${k}`) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px',
      border: '1px dashed var(--border)', borderRadius: 8, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 140, flexShrink: 0 }}>
          <SelectMenu value={type} onChange={v => { setType(v as NoteLinkPrincipalType); setQuery('') }}
            options={typeOptions} placeholder={t('notes.links.pickType')} />
        </div>
        {/* selectAll={false}: this picker adds ONE link and the caller closes it — a
            select-all over a server-searched entity list has no meaning here (§3). */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchSelect triggerLabel={t('notes.links.pickEntity')} options={options} selected={[]} onSearch={setQuery} selectAll={false}
            disabled={busy}
            onToggle={(v: string) => { const r = rows.find(x => String(x.id) === v); onAdd({ type, id: v, label: r ? cfg.label(r) : '' }) }} />
        </div>
        {busy && <Spinner size={13} />}
        <Button variant="ghost" iconOnly size="sm" onClick={onClose} title={t('cancel')} aria-label={t('cancel')}>
          <X size={13} />
        </Button>
      </div>
      {/* Load error (§3, four UI states): distinct from "no matches" so the user
          knows the search itself failed and can retry it. */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FieldNotice text={t('error.loadFailed')} />
          <Button variant="secondary" size="sm" onClick={fetchOptions}>{t('error.retry')}</Button>
        </div>
      )}
    </div>
  )
}
