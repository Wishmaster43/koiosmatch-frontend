/**
 * AddLinkRow — the inline "pick a type, then pick an entity" coupling row.
 * Lifted verbatim out of `drawer/LinksTab.tsx` (behaviour unchanged: same
 * server-searched capped fetch, same freshness guard, same error+retry line)
 * the moment a SECOND surface needed it — the CREATE form (Danny 08-08 punt 15)
 * now couples a new task to a customer/location/department/contact through this
 * exact component and the shared `taskLinkTypes` vocabulary, never a second
 * hand-built picker (§11 one source).
 *
 * `types` narrows the offered vocabulary for a host that already exposes some
 * tokens as dedicated fields (the create modal keeps candidate/customer/contact
 * as their own pickers, so it passes the remaining tokens here).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import api, { unwrapList } from '@/lib/api'
import { SelectField } from '@/components/forms/fields'
import SearchSelectJs from '@/components/ui/SearchSelect'
import { TASK_LINK_ENDPOINTS, TASK_LINK_TYPES } from './taskLinkTypes'
import type { LinkRow } from './taskLinkTypes'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const SearchSelect = SearchSelectJs as unknown as ComponentType<AnyProps>

export interface NewLink { type: string; id: string; label: string }

export default function AddLinkRow({ existing, onAdd, onClose, types = TASK_LINK_TYPES }: {
  // Already-coupled records — filtered out of the entity picker per type.
  existing: Array<{ type: string; id: Id | null }>
  onAdd: (link: NewLink) => void
  onClose: () => void
  // Offered link tokens; defaults to the full shared vocabulary.
  types?: string[]
}) {
  const { t } = useTranslation(['tasks', 'common'])
  const [type, setType] = useState(types[0] ?? '')
  const [rows, setRows] = useState<LinkRow[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState(false)
  // Freshness guard (mirrors RelatedTasks.tsx/NotesTab.tsx in this same drawer):
  // lets the retry button re-run this exact fetch without a stale in-flight
  // response overwriting a newer one.
  const requestIdRef = useRef(0)

  // Load a capped, server-searched page for the chosen type — never the whole
  // table. A failed load surfaces its OWN error line (audit finding 2026-08-05:
  // this used to silently swallow the failure, leaving the picker at zero
  // options — indistinguishable from "no matches for this search").
  const fetchOptions = useCallback(() => {
    const cfg = TASK_LINK_ENDPOINTS[type]
    if (!cfg) { setRows([]); return }
    const requestId = ++requestIdRef.current
    setError(false)
    api.get(cfg.url, { params: { q: query, search: query, per_page: 25 } })
      .then(r => { if (requestIdRef.current === requestId) setRows(unwrapList<LinkRow>(r).rows) })
      .catch(() => { if (requestIdRef.current === requestId) setError(true) })
  }, [type, query])
  useEffect(() => { setRows([]); fetchOptions() }, [fetchOptions])

  const cfg = TASK_LINK_ENDPOINTS[type]
  const linked = new Set(existing.filter(l => l.type === type).map(l => String(l.id)))
  const options = cfg ? rows.filter(r => !linked.has(String(r.id))).map(r => ({ value: String(r.id), label: cfg.label(r) })) : []
  const typeOptions = types.map(k => ({ value: k, label: t(`links.${k}`) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px',
      border: '1px dashed var(--border)', borderRadius: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 150, flexShrink: 0 }}>
          {/* `placeholder` names the search box inside the popover (the trigger
              itself always shows a real type, so it never renders as placeholder
              text) — the picker had NO accessible name at all before (§6). */}
          <SelectField value={type} onChange={v => { setType(v); setQuery('') }} options={typeOptions} placeholder={t('links.linkType')} />
        </div>
        {/* selectAll={false}: this picker adds ONE link and closes — a select-all
            over a server-searched entity list has no meaning here (§3). */}
        <SearchSelect triggerLabel={t('links.selectEntity')} options={options} selected={[]} onSearch={setQuery} selectAll={false}
          onToggle={(v: string) => { const r = rows.find(x => String(x.id) === v); onAdd({ type, id: v, label: r && cfg ? cfg.label(r) : '' }); onClose() }} />
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onClose} aria-label={t('modal.cancel')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
          <X size={15} />
        </button>
      </div>
      {/* Load error (§3, four UI states): distinct from "no matches" so the
          recruiter knows the search itself failed and can retry it. */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-danger-text)' }}>
          <span>{t('links.loadError')}</span>
          <button type="button" onClick={fetchOptions} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            padding: '2px 8px', cursor: 'pointer', color: 'var(--text)' }}>{t('common:error.retry')}</button>
        </div>
      )}
    </div>
  )
}
