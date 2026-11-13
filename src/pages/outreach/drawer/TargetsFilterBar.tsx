/**
 * TargetsFilterBar — the call list's client-side search + status/outcome/assignee
 * filter row, moved verbatim out of TargetsTab (SIZE-TRIGGER-1). Presentational:
 * all state lives in the parent.
 */
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
// HUISSTIJL-1: the ONE trio-tinted filter trigger face (§4 tint-vs-trio law).
import FilterTriggerPill from '@/components/ui/FilterTriggerPill'
import Button from '@/components/ui/Button'

interface PickOption { value: string; label: string }

// The search box, three filter pills and the clear-all button of the call list.
export default function TargetsFilterBar({ search, onSearch, statusPick, onStatusPick, outcomePick, onOutcomePick,
  assigneePick, onAssigneePick, statusOptions, outcomeOptions, assigneeOptions, hasLocalFilters, onClearAll }: {
  search: string
  onSearch: (v: string) => void
  statusPick: string | null
  onStatusPick: (v: string | null) => void
  outcomePick: string | null
  onOutcomePick: (v: string | null) => void
  assigneePick: string | null
  onAssigneePick: (v: string | null) => void
  statusOptions: PickOption[]
  outcomeOptions: PickOption[]
  assigneeOptions: PickOption[]
  hasLocalFilters: boolean
  onClearAll: () => void
}) {
  const { t } = useTranslation('outreach')
  return (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
    <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
      <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      <input value={search} onChange={e => onSearch(e.target.value)} placeholder={t('common:search')}
        aria-label={t('common:search')}
        style={{ width: '100%', padding: '5px 8px 5px 26px', fontSize: 12, borderRadius: 7,
          border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
    </div>
    {/* HUISSTIJL-1: these three narrow the already-loaded list — filter role,
        never a value to save — so the trigger wears the house trio pill
        (FilterTriggerPill) instead of the calm form-field box. Individual
        clearing now goes through the shared "clear all" text button below
        (mirrors VacancySearchFilters/CandidateSearchTab, which carry no
        per-field clear either); the inline X only exists on the calm box. */}
    <CreatableSelect value={statusPick} onChange={onStatusPick} allowCreate={false}
      placeholder={t('drawer.stats.byStatus')}
      options={statusOptions}
      renderTrigger={toggle => (
        /* eslint-disable huisstijlLegacy/no-restricted-syntax -- zero-chrome CreatableSelect renderTrigger wrapper (no fill/border/padding of its own); visible identity is entirely FilterTriggerPill's, mirrors StatusFilterSelect.tsx/VacancySearchFilters.tsx */
        <button type="button" onClick={toggle} aria-haspopup="listbox" aria-label={t('drawer.stats.byStatus')}
          style={{ background: 'none', border: 'none', padding: 0 }}>
          <FilterTriggerPill label={t('drawer.stats.byStatus')} count={statusPick ? 1 : 0} />
        </button>
        /* eslint-enable huisstijlLegacy/no-restricted-syntax */
      )} />
    <CreatableSelect value={outcomePick} onChange={onOutcomePick} allowCreate={false}
      placeholder={t('drawer.stats.byOutcome')}
      options={outcomeOptions}
      renderTrigger={toggle => (
        /* eslint-disable huisstijlLegacy/no-restricted-syntax -- zero-chrome CreatableSelect renderTrigger wrapper (no fill/border/padding of its own); visible identity is entirely FilterTriggerPill's, mirrors StatusFilterSelect.tsx/VacancySearchFilters.tsx */
        <button type="button" onClick={toggle} aria-haspopup="listbox" aria-label={t('drawer.stats.byOutcome')}
          style={{ background: 'none', border: 'none', padding: 0 }}>
          <FilterTriggerPill label={t('drawer.stats.byOutcome')} count={outcomePick ? 1 : 0} />
        </button>
        /* eslint-enable huisstijlLegacy/no-restricted-syntax */
      )} />
    <CreatableSelect value={assigneePick} onChange={onAssigneePick} allowCreate={false}
      placeholder={t('drawer.stats.byAssignee')}
      options={assigneeOptions}
      renderTrigger={toggle => (
        /* eslint-disable huisstijlLegacy/no-restricted-syntax -- zero-chrome CreatableSelect renderTrigger wrapper (no fill/border/padding of its own); visible identity is entirely FilterTriggerPill's, mirrors StatusFilterSelect.tsx/VacancySearchFilters.tsx */
        <button type="button" onClick={toggle} aria-haspopup="listbox" aria-label={t('drawer.stats.byAssignee')}
          style={{ background: 'none', border: 'none', padding: 0 }}>
          {/* assigneePick === '' is the real "unassigned" pick (matchesLocalFilters
              checks `!== null`, not truthiness) — count on that, not on truthiness,
              or picking "unassigned" would show an active filter with no badge. */}
          <FilterTriggerPill label={t('drawer.stats.byAssignee')} count={assigneePick !== null ? 1 : 0} />
        </button>
        /* eslint-enable huisstijlLegacy/no-restricted-syntax */
      )} />
    {hasLocalFilters && (
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        {t('common:filters.clearAll')}
      </Button>
    )}
  </div>
  )
}
