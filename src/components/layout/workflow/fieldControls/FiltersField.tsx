/**
 * Filters field — inline conditions builder (field / operator / value + AND-OR),
 * used inside an entity module so fetch + filter live in one module. Shares
 * FilterFieldPicker + OperatorSelect with the edge-filter modal (FILTER-VELD-1);
 * `field.fields` supplies the selectable field list. The standalone
 * Filter/Router between modules stays untouched (for multi-status branching).
 * Split out of the former fieldControls.tsx monolith (§3 400-line split trigger).
 */
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { VALUELESS_OPERATORS, normalizeOperator } from '../constants'
import { fieldLabel } from '../moduleI18n'
import { FilterFieldPicker } from '../FilterFieldPicker'
import { OperatorSelect } from '../OperatorSelect'
import SegmentedControl from '@/components/ui/SegmentedControl'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import type { WorkflowField, EdgeFilters, FilterCondition } from '@/types/workflow'
import type { OnChange } from './types'

// ── Filters field ───────────────────────────────────────────────────────────────
export function FiltersField({ field, value, onChange }: { field: WorkflowField; value?: EdgeFilters; onChange: OnChange }) {
  const { t } = useTranslation('workflows')
  const logic = value?.logic ?? 'AND'
  const conds: FilterCondition[] = Array.isArray(value?.conditions) ? value!.conditions! : []
  // This entity module's own filterable fields (its own type — not an upstream
  // chain, since the module fetches/updates its own records) — translated via
  // the shared fieldLabel() convention, fed into the same FilterFieldPicker the
  // edge-filter modal uses (FILTER-VELD-1) so field+"Toon als" behave identically.
  const fieldOptions = (field.fields ?? []).map(o => {
    const v = typeof o === 'object' ? o.value : o
    const l = typeof o === 'object' ? o.label : o
    return { value: String(v), label: fieldLabel(t, l as string) }
  })

  const set      = (next: EdgeFilters)        => onChange(field.key, next)
  const setLogic = (l: string)                => set({ logic: l, conditions: conds })
  const add      = ()                         => set({ logic, conditions: [...conds, { field: '', operator: '=', value: '' }] })
  const del      = (i: number)                => set({ logic, conditions: conds.filter((_, j) => j !== i) })
  const upd      = (i: number, k: keyof FilterCondition, v: string) => set({ logic, conditions: conds.map((c, j) => j === i ? { ...c, [k]: v } : c) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* AND / OR — verify round 22-08: a choice-switch is the shared
          SegmentedControl (compact), never hand-painted accent pills. */}
      {conds.length > 1 && (
        <SegmentedControl size="compact" ariaLabel={t('fields.logicAll')}
          options={[{ value: 'AND', label: t('fields.logicAll') }, { value: 'OR', label: t('fields.logicAny') }]}
          value={logic} onChange={setLogic} />
      )}
      {/* Condition rows — the field+"Toon als" picker gets its own full-width row
          (packs two controls); this panel is narrower than the edge-filter modal,
          so cramming it beside operator/value/delete truncated it to a sliver. */}
      {conds.map((c, i) => {
        const needsValue = !VALUELESS_OPERATORS.includes(normalizeOperator(c.operator))
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 6, border: '1px solid var(--border)', borderRadius: 6 }}>
            <FilterFieldPicker value={c.field ?? ''} options={fieldOptions} onChange={v => upd(i, 'field', v)} />
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <OperatorSelect value={normalizeOperator(c.operator)} onChange={v => upd(i, 'operator', v)}
                style={{ padding: '5px 4px' }} />
              {needsValue && (
                <input value={c.value ?? ''} onChange={e => upd(i, 'value', e.target.value)} placeholder={t('fields.valuePlaceholder')} aria-label={t('fields.valuePlaceholder')}
                  style={{ flex: 1, minWidth: 0, padding: '5px 7px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
              )}
              <button type="button" onClick={() => del(i)} aria-label={t('fields.removeCondition')} title={t('fields.removeCondition')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dense inline row-remove with imperative hover swap (EntityHeader menu-row precedent); a 28px Button breaks the row height
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', padding: 2, display: 'flex' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--border)')}><X size={13} /></button>
            </div>
          </div>
        )
      })}
      {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
      <DrawerAddButton onClick={add} label={t('fields.addCondition')} />
    </div>
  )
}
