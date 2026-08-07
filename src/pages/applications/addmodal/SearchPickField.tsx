/**
 * SearchPickField — field label + a SERVER-SEARCHED single-select (SearchSelect),
 * the candidate/vacancy pickers only (§0.3 split out of AddApplicationModal,
 * mirrors the candidate addmodal/ folder). The old CreatableSelect pair filtered
 * ONE client-fetched page of 100 rows locally, with no way to reach row 101;
 * SearchSelect's own `onSearch` (already debounced 250ms inside the component —
 * the house idiom, mirrors tasks/drawer/LinksTab's identical candidate/vacancy/…
 * picker) drives a REAL server round-trip per edit instead, so typing reaches
 * the whole tenant table. The trigger is hand-styled to match PickField/
 * CreatableSelect exactly (label-prefixed button + chevron), so all pickers on
 * this form stay visually identical (§4).
 */
import { useId } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import SearchSelectJs from '@/components/ui/SearchSelect'
import type { PickOption } from './types'

type AnyProps = Record<string, unknown>
const SearchSelect = SearchSelectJs as unknown as ComponentType<AnyProps>

export default function SearchPickField({ label, placeholder, value, options, onPick, onSearch, error, searchError, onRetry }: {
  label: ReactNode; placeholder?: string; value: PickOption | null; options: PickOption[]
  onPick: (opt: PickOption) => void; onSearch: (query: string) => void
  error?: boolean; searchError?: boolean; onRetry: () => void
}) {
  const { t } = useTranslation('applications')
  const labelId = useId()
  const triggerId = useId()
  return (
    <div>
      <div id={labelId} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <SearchSelect
        width={320}
        options={options.map(o => ({ value: String(o.value), label: o.label }))}
        selected={value ? [String(value.value)] : []}
        onSearch={onSearch}
        closeOnToggle
        onToggle={(v: string) => { const opt = options.find(o => String(o.value) === v); if (opt) onPick(opt) }}
        renderTrigger={(toggle: () => void) => (
          <button type="button" id={triggerId} onClick={toggle} aria-labelledby={`${labelId} ${triggerId}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', width: '100%',
              boxSizing: 'border-box', border: `1px solid ${error ? 'var(--color-danger)' : 'var(--border)'}`,
              borderRadius: 6, background: 'var(--surface)', cursor: 'pointer' }}>
            <span style={{ fontSize: 12, flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis', color: value ? 'var(--text)' : 'var(--text-muted)' }}>
              {value?.label ?? placeholder}
            </span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        )}
      />
      {/* Search failure — a real state (§3), never a silent empty list: unlike the old
          one-shot mount fetch, a query now fires on every edit, so a transient failure
          is more likely and needs its own recovery path (retry re-issues the SAME query,
          which an unchanged search box would otherwise never re-trigger). */}
      {searchError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: 'var(--color-danger)' }}>
          <span>{t('add.searchError')}</span>
          <button type="button" onClick={onRetry}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px', cursor: 'pointer', color: 'var(--text)' }}>
            {t('common:error.retry')}
          </button>
        </div>
      )}
    </div>
  )
}
