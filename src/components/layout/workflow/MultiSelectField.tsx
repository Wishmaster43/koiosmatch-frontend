/**
 * MultiSelectField (WF-MULTISELECT-1, Danny 23-07) — the searchable multi-select for
 * workflow config fields. Four option sources, in priority order:
 *   1. `field.endpoint` — a live API lookup (WF-BUILDER-VELDEN-1, e.g. notification_send's
 *      user_ids → GET /users) resolved the same way LookupSelectField resolves a single
 *      lookup_select, just rendered through this multi-value chip UI instead;
 *   2. `field.source` — a tenant lookup (candidate_statuses / candidate_phases /
 *      candidate_types) resolved live from LookupsContext, so the choices are the
 *      tenant's OWN configured lists;
 *   3. `field.options` — a static list from the module schema;
 *   4. none of the above (e.g. Plaats) — free entry: type a value + Enter adds it as a chip.
 * Selected values render as removable chips; the dropdown filters as you type.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, X } from 'lucide-react'
import { useLookups } from '@/context/LookupsContext'
import SelectAllRow from '@/components/ui/SelectAllRow'
import { optionLabel } from './moduleI18n'
import { unwrapList } from '@/lib/api'
import type { WorkflowField } from '@/types/workflow'
import type { OnChange } from './fieldControls'

type Opt = { value: string; label: string }

// Searchable multi-value chip picker for workflow config fields; resolves its option list from an endpoint, tenant lookup, static schema options, or falls back to free-text entry — priority order documented in the module doc above.
export default function MultiSelectField({ field, value, onChange }: {
  field: WorkflowField; value?: unknown; onChange: OnChange
}) {
  const { t } = useTranslation('workflows')
  const lookups = useLookups()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const endpoint = typeof field.endpoint === 'string' ? field.endpoint : undefined
  const valueKey = typeof field.valueKey === 'string' ? field.valueKey : undefined
  // Endpoint-backed options (fetched once per endpoint) — mirrors LookupSelectField's
  // own fetch; an error still surfaces as an honest error state (see remoteError below), not a silent empty list.
  const [remoteOpts, setRemoteOpts] = useState<Opt[]>([])
  const [remoteLoading, setRemoteLoading] = useState(!!endpoint)
  // A failed load must read as an error, never as "no results" (R8) — see the dropdown render below.
  const [remoteError, setRemoteError] = useState(false)

  // Fetches the endpoint-backed option list once per endpoint (mirrors LookupSelectField); an alive guard drops the result on unmount, and a failure sets remoteError so the dropdown shows the honest error state instead of "no results".
  useEffect(() => {
    if (!endpoint) { setRemoteLoading(false); return }
    let alive = true
    setRemoteLoading(true)
    setRemoteError(false)
    import('@/lib/api').then(m => m.default.get(endpoint))
      .then(r => {
        const rows = (unwrapList(r).rows) as Array<Record<string, unknown>>
        if (alive) setRemoteOpts(rows
          .map(o => ({ value: String((valueKey ? o[valueKey] : undefined) ?? o.value ?? o.id ?? ''), label: String(o.label ?? o.name ?? o.value ?? '') }))
          .filter(o => o.value))
      })
      .catch(() => { if (alive) setRemoteError(true) })
      .finally(() => { if (alive) setRemoteLoading(false) })
    return () => { alive = false }
  }, [endpoint, valueKey])

  const selected: string[] = Array.isArray(value) ? (value as string[]) : []

  // Resolve the option list: endpoint → tenant lookup (by source) → static schema options → none (free entry).
  const options: Opt[] = useMemo(() => {
    if (endpoint) return remoteOpts
    const bySource: Record<string, { value: string; label: string }[]> = {
      candidate_statuses: lookups.statuses,
      candidate_phases: lookups.phases,
      candidate_types: lookups.candidateTypes,
    }
    if (field.source && bySource[field.source]) {
      return bySource[field.source].map(o => ({ value: o.value, label: o.label }))
    }
    return ((field.options ?? []) as string[]).map(o => ({ value: o, label: optionLabel(t, o) }))
  }, [endpoint, remoteOpts, field.source, field.options, lookups, t])

  // An endpoint field is never free-entry (an unmatched value would never resolve to a
  // real record); it just shows the loading/no-results states below instead.
  const freeEntry = options.length === 0 && !endpoint
  const labelFor = (v: string) => options.find(o => o.value === v)?.label ?? v
  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()))

  const add = (v: string) => { if (v && !selected.includes(v)) onChange(field.key, [...selected, v]); setSearch('') }
  const remove = (v: string) => onChange(field.key, selected.filter(s => s !== v))

  // Select-all / clear-all over the VISIBLE (filtered) options. This host owns the
  // whole array, so the batch lands in ONE onChange — no per-value queue needed
  // (unlike the onToggle-only hosts, see useBatchToggle).
  const applyAll = (values: string[], select: boolean) =>
    onChange(field.key, select
      ? [...selected, ...values.filter(v => !selected.includes(v))]
      : selected.filter(s => !values.includes(s)))

  return (
    <div ref={boxRef} style={{ position: 'relative' }}
      onBlur={e => { if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false) }}>
      {/* Control: selected chips + the search input, dropdown-styled. */}
      <div onClick={() => setOpen(true)}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, minHeight: 34,
                 padding: '4px 28px 4px 8px', borderRadius: 8, border: '1px solid var(--border)',
                 background: 'var(--surface)', cursor: 'text', position: 'relative' }}>
        {selected.map(v => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                                 borderRadius: 999, fontSize: 12, background: 'var(--color-primary-bg)',
                                 color: 'var(--color-primary-text)' }}>
            {labelFor(v)}
            <button type="button" aria-label={t('common:remove', { defaultValue: 'Verwijderen' })}
              onClick={e => { e.stopPropagation(); remove(v) }}
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dense inline chip-remove icon inside a 2px/8px pill (fieldControls.tsx row-remove precedent); a 28px Button breaks the chip height
              style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input value={search} placeholder={selected.length === 0 ? t('fields.multiselectSearch', { defaultValue: 'Zoeken…' }) : ''}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onKeyDown={e => {
            // Free-entry (no option list): Enter adds the typed value as a chip.
            if (freeEntry && e.key === 'Enter') { e.preventDefault(); add(search.trim()) }
            if (e.key === 'Escape') setOpen(false)
          }}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the dropdown's own search INPUT size/colour (fields.tsx SettingsSearch precedent), not a BodyText paragraph render
          style={{ flex: 1, minWidth: 90, border: 'none', outline: 'none', background: 'transparent',
                   fontSize: 13, color: 'var(--text)', padding: '3px 2px' }} />
        <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: 10, color: 'var(--text-muted)' }} />
      </div>

      {/* Dropdown: filtered options (or the free-entry hint). */}
      {open && (
        // HUISSTIJL-1: dropdown menu — z-popover ladder tier, shadow-float role.
        <div style={{ position: 'absolute', zIndex: 'var(--z-popover)', top: '100%', left: 0, right: 0, marginTop: 4,
                      maxHeight: 220, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', boxShadow: 'var(--shadow-float)' }}>
          {/* Select-all pinned above the list (free entry / still loading has no list to
              select). HUISSTIJL-1: zIndex:1 orders this sticky row above its own sibling
              list items WITHIN this dropdown — internal layering, exempt from the z-ladder. */}
          {!freeEntry && !(endpoint && remoteLoading) && filtered.length > 0 && (
            <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)', padding: '6px 8px 0' }}>
              <SelectAllRow dense visibleValues={filtered.map(o => o.value)} selectedValues={selected} onApply={applyAll} />
            </div>
          )}
          {endpoint && remoteLoading ? (
            <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              {t('fields.multiselectLoading', { defaultValue: 'Opties laden…' })}
            </div>
          ) : endpoint && remoteError ? (
            <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--color-danger-text)' }}>
              {t('common:errorGeneric')}
            </div>
          ) : freeEntry ? (
            <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              {t('fields.multiselectFreeEntry', { defaultValue: 'Typ een waarde en druk op Enter om toe te voegen.' })}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
              {t('fields.multiselectNoResults', { defaultValue: 'Geen resultaten.' })}
            </div>
          ) : filtered.map(o => {
            const active = selected.includes(o.value)
            return (
              <button key={o.value} type="button"
                onMouseDown={e => e.preventDefault() /* keep focus so blur doesn't close first */}
                onClick={() => (active ? remove(o.value) : add(o.value))}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- full-width dropdown OPTION ROW (a selection row, not a discrete action) inside this custom searchable multi-select; a Button atom would break the row's own 8px/12px hit-target
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                         padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 13,
                         background: active ? 'var(--color-primary-bg)' : 'transparent',
                         // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                         color: active ? 'var(--color-primary-text)' : 'var(--text)' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                               border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                               // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- a 14px checkbox-indicator fill (selection state), not a Button/accent surface
                               background: active ? 'var(--color-primary)' : 'transparent' }} />
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
