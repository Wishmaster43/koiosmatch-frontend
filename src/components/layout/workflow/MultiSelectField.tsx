/**
 * MultiSelectField (WF-MULTISELECT-1, Danny 23-07) — the searchable multi-select for
 * workflow config fields. Three option sources:
 *   1. `field.source` — a tenant lookup (candidate_statuses / candidate_phases /
 *      candidate_types) resolved live from LookupsContext, so the choices are the
 *      tenant's OWN configured lists;
 *   2. `field.options` — a static list from the module schema;
 *   3. neither (e.g. Plaats) — free entry: type a value + Enter adds it as a chip.
 * Selected values render as removable chips; the dropdown filters as you type.
 */
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, X } from 'lucide-react'
import { useLookups } from '@/context/LookupsContext'
import { optionLabel } from './moduleI18n'
import type { WorkflowField } from '@/types/workflow'
import type { OnChange } from './fieldControls'

type Opt = { value: string; label: string }

export default function MultiSelectField({ field, value, onChange }: {
  field: WorkflowField; value?: unknown; onChange: OnChange
}) {
  const { t } = useTranslation('workflows')
  const lookups = useLookups()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const selected: string[] = Array.isArray(value) ? (value as string[]) : []

  // Resolve the option list: tenant lookup (by source) → static schema options → none (free entry).
  const options: Opt[] = useMemo(() => {
    const bySource: Record<string, { value: string; label: string }[]> = {
      candidate_statuses: lookups.statuses,
      candidate_phases: lookups.phases,
      candidate_types: lookups.candidateTypes,
    }
    if (field.source && bySource[field.source]) {
      return bySource[field.source].map(o => ({ value: o.value, label: o.label }))
    }
    return ((field.options ?? []) as string[]).map(o => ({ value: o, label: optionLabel(t, o) }))
  }, [field.source, field.options, lookups, t])

  const freeEntry = options.length === 0
  const labelFor = (v: string) => options.find(o => o.value === v)?.label ?? v
  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase()) || o.value.toLowerCase().includes(search.toLowerCase()))

  const add = (v: string) => { if (v && !selected.includes(v)) onChange(field.key, [...selected, v]); setSearch('') }
  const remove = (v: string) => onChange(field.key, selected.filter(s => s !== v))

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
                                 color: 'var(--color-primary)' }}>
            {labelFor(v)}
            <button type="button" aria-label={t('common:remove', { defaultValue: 'Verwijderen' })}
              onClick={e => { e.stopPropagation(); remove(v) }}
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
          style={{ flex: 1, minWidth: 90, border: 'none', outline: 'none', background: 'transparent',
                   fontSize: 13, color: 'var(--text)', padding: '3px 2px' }} />
        <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: 10, color: 'var(--text-muted)' }} />
      </div>

      {/* Dropdown: filtered options (or the free-entry hint). */}
      {open && (
        <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, marginTop: 4,
                      maxHeight: 220, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {freeEntry ? (
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
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                         padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 13,
                         background: active ? 'var(--color-primary-bg)' : 'transparent',
                         color: active ? 'var(--color-primary)' : 'var(--text)' }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                               border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
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
