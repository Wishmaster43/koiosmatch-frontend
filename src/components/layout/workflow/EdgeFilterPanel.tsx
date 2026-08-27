/**
 * EdgeFilterPanel — the per-edge filter/router-branch editor. Builds one or more
 * OR'ed AND-groups of field/operator/value conditions (mirrors the backend
 * FilterEvaluator's `[[…],[…]]` OR-group contract) plus the route (branch) name
 * shown on the edge. Extracted from canvas.tsx once OR-groups + date/time
 * operators pushed that file past the ~400-line split trigger.
 *
 * FILTER-VELD-1 (Danny 2026-07-13, Make-parity): the field input is now a
 * numbered, per-module Make-style picker instead of free text — it walks the
 * edge SOURCE node's upstream chain (via the persisted graph) and lists every
 * ancestor module's catalogued bundle fields up to the nearest `emits: replace`
 * boundary. `sourceNodeId`/`nodes`/`edges`/`catalog` are optional so the panel
 * still renders (picker just empty, CreatableSelect's free-entry path covers it)
 * if a caller can't supply the graph.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { parseEdgeFilterGroups, edgeFilterGroupsToFilters } from './serialization'
import { VALUELESS_OPERATORS } from './constants'
import { collectUpstreamFilterFields, toFilterFieldOptions, type ModuleCatalog } from './filterFieldCatalog'
import { FilterFieldPicker } from './FilterFieldPicker'
import { OperatorSelect } from './OperatorSelect'
import { MODULE_META } from '@/modules/index'
import type { FilterCondition, FilterConditionGroup, EdgeFilters, FlowNode, FlowEdge } from '@/types/workflow'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/typography'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'

// A short syntax reminder for the newer date/time operators — undefined (no
// hint row rendered) for the plain equality/text operators.
function operatorHint(t: (key: string) => string, operator?: string): string | undefined {
  // date_older_than_days takes a DAY COUNT, not a date — the exact-match branch
  // must run before the date_ prefix test or it inherits the wrong syntax hint
  // (verify round 22-08: the hint told users to type a date here).
  if (operator === 'date_older_than_days' || operator === 'date_younger_than_days') return t('canvas.filterDaysHint')
  if (operator?.startsWith('date_')) return t('canvas.filterDateHint')
  if (operator === '>' || operator === '>=' || operator === '<' || operator === '<=') return t('canvas.filterClockHint')
  return undefined
}

// See the file's top doc above for the OR-group filter/branch contract this editor builds against.
export function EdgeFilterPanel({ filters, label, sourceNodeId, nodes = [], edges = [], catalog = {}, onClose, onSave }: {
  filters?: unknown; label?: string
  sourceNodeId?: string
  nodes?: FlowNode[]
  edges?: FlowEdge[]
  catalog?: ModuleCatalog
  onClose: () => void; onSave: (f: EdgeFilters, label: string) => void
}) {
  // `groups` is always ≥1 AND-group; ≥2 groups are OR'ed (the new capability).
  const [groups, setGroups] = useState<FilterConditionGroup[]>(() => parseEdgeFilterGroups(filters))
  const [name, setName] = useState(label ?? '')
  const { t } = useTranslation('workflows')

  // Make-style numbered field options: walk the edge source's upstream chain
  // once per graph change, then flatten to "N. <module label> · <field>" options.
  const fieldOptions = useMemo(() => {
    if (!sourceNodeId) return []
    const graphNodes = nodes.map(n => ({ id: n.id, type: n.data.type ?? '', config: n.data.config }))
    const graphEdges = edges.map(e => ({ source: e.source, target: e.target }))
    const groupsUpstream = collectUpstreamFilterFields(sourceNodeId, graphNodes, graphEdges, catalog)
    return toFilterFieldOptions(groupsUpstream, type => t('modules.' + type, { defaultValue: MODULE_META[type]?.label ?? type }))
  }, [sourceNodeId, nodes, edges, catalog, t])

  // Group-level mutations — add/remove a whole OR'ed AND-group.
  const addGroup = () => setGroups(gs => [...gs, []])
  const removeGroup = (gi: number) => setGroups(gs => (gs.length > 1 ? gs.filter((_, i) => i !== gi) : gs))

  // Condition-level mutations, scoped to one group by index.
  const addCond = (gi: number) => setGroups(gs => gs.map((g, i) => (i === gi ? [...g, { field: '', operator: '=', value: '' }] : g)))
  const delCond = (gi: number, ci: number) => setGroups(gs => gs.map((g, i) => (i === gi ? g.filter((_, j) => j !== ci) : g)))
  const updCond = (gi: number, ci: number, key: keyof FilterCondition, val: string) =>
    setGroups(gs => gs.map((g, i) => (i === gi ? g.map((row, j) => (j === ci ? { ...row, [key]: val } : row)) : g)))

  // Persist: ≤1 non-empty group keeps the legacy flat `{conditions,logic}`
  // shape; ≥2 groups emit the backend's nested OR-group array directly. The
  // cast satisfies useWorkflowEditor's `saveEdgeFilter(filters: EdgeFilters, …)`
  // signature (that hook is out of scope here); it only ever forwards the value
  // untouched into the edge's opaque `data.filters: unknown`, so widening the
  // runtime shape is safe — TS just doesn't model that union at its signature.
  const handleSave = () => {
    onSave(edgeFilterGroupsToFilters(groups) as EdgeFilters, name.trim())
    onClose()
  }

  return (
    // POPUP-SLEEP (Danny punt 19): the shared FloatingPanel shell — this editor is
    // dragged aside by its header to compare against the canvas behind it, and keeps
    // the same focus trap / Escape-to-close it had inline.
    <FloatingPanel open onClose={onClose} ariaLabel={t('canvas.filterTitle')}
      width={660} maxWidth="96vw" persistKey="edge-filter" bodyStyle={{ padding: 24 }}
      header={<PageTitle as="div">{t('canvas.filterTitle')}</PageTitle>}>

      {/* Route naam — the Router branch name (Make-style); shown on the edge */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          {t('canvas.routeName')}
        </label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('canvas.routeNamePlaceholder')} aria-label={t('canvas.routeName')}
          style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* OR'ed groups — each group ANDs its own conditions; "+ OF-groep" adds another */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 10px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary-text)', background: 'var(--color-primary-bg)', borderRadius: 999, padding: '2px 10px' }}>
                  {t('canvas.orDivider')}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            )}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('canvas.groupLabel', { n: gi + 1 })}
                  </span>
                  <Button variant="ghost" size="sm" iconOnly onClick={() => removeGroup(gi)}
                    title={t('canvas.removeGroup')} aria-label={t('canvas.removeGroup')}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              )}
              {group.map((c, ci) => {
                const hint = operatorHint(t, c.operator)
                return (
                  <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Row 1 — the Make-style field+"Toon als" picker gets its own full-width
                        row (it packs two controls); cramming it beside operator/value/delete
                        left it truncated to a sliver on narrower panels. */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {ci > 0
                        ? <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', width: 28, textAlign: 'center', flexShrink: 0 }}>{t('canvas.andLabel')}</div>
                        : <div style={{ width: 28, flexShrink: 0 }} />}
                      <FilterFieldPicker value={c.field ?? ''} options={fieldOptions}
                        onChange={v => updCond(gi, ci, 'field', v)} />
                    </div>
                    {/* Row 2 — operator + value + delete */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingLeft: 34 }}>
                      <OperatorSelect value={c.operator} onChange={v => updCond(gi, ci, 'operator', v)} />
                      {!VALUELESS_OPERATORS.includes(c.operator ?? '') && (
                        <input value={c.value} onChange={e => updCond(gi, ci, 'value', e.target.value)}
                          placeholder={t('fields.valuePlaceholder')} aria-label={t('fields.valuePlaceholder')}
                          style={{ flex: 1, padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
                      )}
                      <button onClick={() => delCond(gi, ci)} aria-label={t('canvas.deleteCondition')} title={t('canvas.deleteCondition')}
                        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- danger-ink ghost icon: no Button tone carries danger ink on a bare face (ProfileTab precedent)
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: 4 }}><Trash2 size={12} /></button>
                    </div>
                    {hint && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: 34, marginTop: 2 }}>{hint}</div>
                    )}
                  </div>
                )
              })}
              {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
              <DrawerAddButton onClick={() => addCond(gi)} label={t('fields.addCondition')} />
            </div>
          </div>
        ))}
      </div>

      {/* Full-width trigger: Button variant="soft" (§4 tint), not DrawerAddButton — this
          spans the whole panel, unlike the row-level "+ add condition" affordance above. */}
      <Button variant="soft" size="sm" onClick={addGroup} style={{ width: '100%', marginBottom: 20 }}>
        <Plus size={12} /> {t('canvas.addGroup')}
      </Button>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>{t('common:cancel')}</Button>
        <Button variant="primary" onClick={handleSave}>
          {t('common:save')}
        </Button>
      </div>
    </FloatingPanel>
  )
}
