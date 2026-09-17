/**
 * KpiDefinitionRow — one tenant KPI inside KpiEntityPanel's DragList. Composed
 * from shared atoms (BodyText/Caption/Toggle/Button), never copied from
 * StatusListRow: this row's shape (chips for dimension/unit/target/surfaces,
 * no colour swatch, no icon picker) is its own, not a status list.
 */
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Toggle from '@/components/ui/Toggle'
import { BodyText, Caption } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'
import { UNIT_LABEL_KEY } from './kpiUnitOptions'
import type { KpiDefinition } from './kpiDefinitionsApi'

interface KpiDefinitionRowProps {
  row: KpiDefinition
  canEdit: boolean
  onToggleActive: (id: string, active: boolean) => void
  onEdit: (row: KpiDefinition) => void
  onDelete: (row: KpiDefinition) => void
}

// One read-only info chip — dimension/unit/target/surface badges share this look
// (background var(--hover-bg), pill radius) rather than the coloured soft-chip
// convention: none of these carry a status/phase meaning (§4). Uses the house
// neutral chip fill (not var(--border), which is Button's disabled-face pair
// and fails 4.5:1 with Caption ink — MetadataBadge/WorkflowEditorHeader precedent).
function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <Caption as="span" style={{ background: 'var(--hover-bg)', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>
      {children}
    </Caption>
  )
}

export default function KpiDefinitionRow({ row, canEdit, onToggleActive, onEdit, onDelete }: KpiDefinitionRowProps) {
  const { t } = useTranslation(['settings', 'common'])
  const { formatNumber } = useNumberFormat()

  const label = row.label ?? row.computed?.metric_label ?? row.metric_key
  const disabledTitle = canEdit ? undefined : t('kpiBuilder.noPermission')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      <BodyText as="span" style={{ flexShrink: 0 }}>{label}</BodyText>
      {row.dimension !== 'all' && (
        <InfoChip>{t(`kpiBuilder.dimension.${row.dimension}`, { defaultValue: row.dimension })}</InfoChip>
      )}
      {row.dimension !== 'all' && row.dimension_value == null && (
        <InfoChip>{t('kpiBuilder.fanOutBadge')}</InfoChip>
      )}
      <InfoChip>{t(UNIT_LABEL_KEY[row.unit])}</InfoChip>
      {row.target_value != null && (
        <InfoChip>{t('kpiBuilder.targetBadge', { value: formatNumber(row.target_value) })}</InfoChip>
      )}
      {row.surfaces.map(surface => (
        <InfoChip key={surface}>{t(`kpiBuilder.surface.${surface}`)}</InfoChip>
      ))}
      <div style={{ flex: 1 }} />
      <Toggle checked={row.active} onChange={v => onToggleActive(row.id, v)} disabled={!canEdit}
        ariaLabel={t('kpiBuilder.activeAria')} title={disabledTitle} />
      <Button variant="secondary" iconOnly aria-label={t('common:edit')} title={disabledTitle}
        disabled={!canEdit} onClick={() => onEdit(row)}>
        <Pencil size={11} />
      </Button>
      <Button variant="dangerSoft" iconOnly aria-label={t('common:delete')} title={disabledTitle}
        disabled={!canEdit} onClick={() => onDelete(row)}>
        <Trash2 size={11} />
      </Button>
    </div>
  )
}
