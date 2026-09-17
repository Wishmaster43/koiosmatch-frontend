/**
 * KpiDefinitionForm — add/edit popup for one tenant KPI definition. Every field
 * is a label-left FieldRow (§3A modal canon) over the shared form kit; no native
 * `<select>` anywhere (DROPDOWN-CLEAR-1). On submit: a NEW definition gets its
 * `entity` injected here (the caller only knows which tab is open) and posts the
 * full create body; an EDIT posts only the changed keys (useKpiDefinitionDraft's
 * `changedKeys`) — nothing changed closes the panel without a request.
 */
import { cloneElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ModalFooter from '@/components/ui/ModalFooter'
import Toggle from '@/components/ui/Toggle'
import SegmentedControl from '@/components/ui/SegmentedControl'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import NumberInput from '@/components/ui/NumberInput'
import { BodyText, Caption } from '@/components/ui/typography'
import { FieldRow, SelectField, TextField } from '@/components/forms/fields'
import { useKpiDefinitionDraft } from './useKpiDefinitionDraft'
import KpiDimensionValueField from './KpiDimensionValueField'
import { unitOptionsFor, UNIT_LABEL_KEY, SURFACE_OPTIONS } from './kpiUnitOptions'
import type { KpiDefinition, KpiDefinitionCreate, KpiDefinitionPatch, KpiEntity, KpiEntityRegistry, KpiUnit } from './kpiDefinitionsApi'

interface KpiDefinitionFormProps {
  entity: KpiEntity
  registry: KpiEntityRegistry
  editing: KpiDefinition | null
  saving?: boolean
  onSubmit: (body: KpiDefinitionCreate | KpiDefinitionPatch) => void
  onClose: () => void
}

// Add/edit popup for one KPI definition — a thin shell composing the shared form kit over useKpiDefinitionDraft's local state.
// FieldRow wires its SINGLE child to the label (id + aria-labelledby, §6); a control that
// needs a hint underneath sits in this wrapper, which forwards those props to the control
// instead of swallowing them on a plain <div>.
function HintedControl({ hint, children, ...labelProps }: { hint: ReactNode; children: ReactElement<Record<string, unknown>>; id?: string; 'aria-labelledby'?: string; 'aria-required'?: true; required?: true }) {
  return (
    <div>
      {cloneElement(children, labelProps)}
      <Caption as="div" style={{ marginTop: 4 }}>{hint}</Caption>
    </div>
  )
}

export default function KpiDefinitionForm({ entity, registry, editing, saving = false, onSubmit, onClose }: KpiDefinitionFormProps) {
  const { t } = useTranslation('settings')
  const { draft, setField, metric, valid, createBody, changedKeys } = useKpiDefinitionDraft(registry, editing)

  const unitChoices = metric ? unitOptionsFor(metric.kind, metric.default_unit) : (draft.unit ? [draft.unit] : [])
  const dimensionOptions = registry.dimensions.map(d => ({ value: d, label: d === 'all' ? t('kpiBuilder.dimensionAll') : t(`kpiBuilder.dimension.${d}`, { defaultValue: d }) }))

  // Create posts the full body (entity injected here); edit posts only the diff — {} closes without a request.
  const handleSubmit = () => {
    if (editing) {
      const patch = changedKeys(editing)
      if (Object.keys(patch).length === 0) { onClose(); return }
      onSubmit(patch)
    } else {
      onSubmit({ entity, ...createBody() })
    }
  }

  return (
    <FloatingPanel open onClose={onClose} ariaLabel={editing ? t('kpiBuilder.editTitle') : t('kpiBuilder.addBtn')}
      title={editing ? t('kpiBuilder.editTitle') : t('kpiBuilder.addBtn')} width={520} persistKey="kpi-definition"
      resizable scrollBody={false}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Metric: locked once created — the row's identity is its metric. */}
        <FieldRow label={t('kpiBuilder.field.metric')} required>
          {/* The shared picker (CreatableSelect) has no disabled prop (measured: not
              in its prop type) — a "disabled-looking but still clickable" picker
              would be a fake affordance (§3), so an EDIT shows the fixed metric as
              plain text instead of a picker nobody can actually change anyway. */}
          {editing
            ? <BodyText>{registry.metrics.find(m => m.key === draft.metric_key)?.label ?? draft.metric_key}</BodyText>
            : <SelectField value={draft.metric_key} onChange={v => setField('metric_key', v)}
                options={registry.metrics.map(m => ({ value: m.key, label: m.label }))}
                placeholder={t('kpiBuilder.placeholder.metric')} />}
        </FieldRow>
        {/* Breakdown dimension — 'all' means one card for the whole entity. */}
        <FieldRow label={t('kpiBuilder.field.dimension')}>
          {/* DROPDOWN-CLEAR-1: the shared clear-X sends '' — map it back to the
              canonical 'all' dimension rather than leaving an invalid empty value. */}
          <SelectField value={draft.dimension} onChange={v => setField('dimension', v || 'all')} options={dimensionOptions} />
        </FieldRow>
        {draft.dimension !== 'all' && (
          <FieldRow label={t('kpiBuilder.field.dimensionValue')}>
            <HintedControl hint={t('kpiBuilder.hint.dimensionValue')}>
              <KpiDimensionValueField entity={entity} dimension={draft.dimension} value={draft.dimension_value}
                onChange={v => setField('dimension_value', v)} />
            </HintedControl>
          </FieldRow>
        )}
        {/* Own name — empty means the metric's own label is shown. */}
        <FieldRow label={t('kpiBuilder.field.label')}>
          <HintedControl hint={t('kpiBuilder.hint.label')}>
            <TextField value={draft.label} onChange={v => setField('label', v)} placeholder={t('kpiBuilder.placeholder.label')} />
          </HintedControl>
        </FieldRow>
        {/* Unit — locked to the metric's own default unless it offers real alternatives. */}
        <FieldRow label={t('kpiBuilder.field.unit')}>
          {unitChoices.length > 1
            ? <SelectField value={draft.unit} onChange={v => setField('unit', v as KpiUnit)}
                options={unitChoices.map(u => ({ value: u, label: t(UNIT_LABEL_KEY[u]) }))} />
            : <Caption>{t('kpiBuilder.hint.unitFixed', { unit: draft.unit ? t(UNIT_LABEL_KEY[draft.unit]) : '' })}</Caption>}
        </FieldRow>
        {/* Judgement — whether higher or lower is better, or no target at all. */}
        <FieldRow label={t('kpiBuilder.field.comparison')}>
          <SegmentedControl size="compact" ariaLabel={t('kpiBuilder.field.comparison')} value={draft.comparison}
            onChange={v => setField('comparison', v as typeof draft.comparison)}
            options={[
              { value: 'gte', label: t('kpiBuilder.comparison.gte') },
              { value: 'lte', label: t('kpiBuilder.comparison.lte') },
              { value: 'none', label: t('kpiBuilder.comparison.none') },
            ]} />
        </FieldRow>
        {draft.comparison !== 'none' && (
          <>
            <FieldRow label={t('kpiBuilder.field.target')}>
              <NumberInput value={draft.target_value} onChange={v => setField('target_value', v)} min={0} decimals={0} />
            </FieldRow>
            <FieldRow label={t('kpiBuilder.field.warn')}>
              <NumberInput value={draft.warn_value} onChange={v => setField('warn_value', v)} min={0} decimals={0} />
            </FieldRow>
          </>
        )}
        {/* Surfaces — 'report' only in this slice (§1.7: dashboard has nothing to render it yet). */}
        <FieldRow label={t('kpiBuilder.field.surfaces')}>
          {/* Toggling only ever adds/removes one of SURFACE_OPTIONS — any value the
              tenant's row already holds outside this slice's options (e.g. 'dashboard'
              set via the API, §1.7) is preserved untouched, never dropped on save. */}
          <ChipMultiSelect values={draft.surfaces}
            onToggle={v => setField('surfaces', (draft.surfaces.includes(v as typeof draft.surfaces[number])
              ? draft.surfaces.filter(s => s !== v)
              : [...draft.surfaces, v as typeof draft.surfaces[number]]))}
            options={SURFACE_OPTIONS.map(s => ({ value: s, label: t(`kpiBuilder.surface.${s}`) }))}
            ariaLabel={t('kpiBuilder.field.surfaces')} selectAll={false} />
        </FieldRow>
        {/* Active — an inactive definition stays in the list but leaves the report band. */}
        <FieldRow label={t('kpiBuilder.field.active')}>
          <Toggle checked={draft.active} onChange={v => setField('active', v)} ariaLabel={t('kpiBuilder.activeAria')} />
        </FieldRow>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={handleSubmit} cancelLabel={t('common:cancel')}
        submitLabel={editing ? t('common:save') : t('kpiBuilder.addBtn')} disabled={saving || !valid} busy={saving} />
    </FloatingPanel>
  )
}
