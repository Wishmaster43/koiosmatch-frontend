/**
 * KpiDimensionValueField — the "one value, or every value" picker shown in the
 * KPI-definition form once a breakdown dimension is chosen. A searchable,
 * clearable select (§3A DROPDOWN-CLEAR-1) over that dimension's own tenant
 * vocabulary (useKpiDimensionValues); left empty the KPI fans out over every
 * value instead of targeting one.
 */
import { useTranslation } from 'react-i18next'
import { SelectField } from '@/components/forms/fields'
import { useKpiDimensionValues } from './useKpiDimensionValues'
import type { KpiEntity } from './kpiDefinitionsApi'

interface KpiDimensionValueFieldProps {
  entity: KpiEntity
  dimension: string
  value: string | null
  onChange: (v: string | null) => void
  id?: string
  'aria-labelledby'?: string
}

export default function KpiDimensionValueField({ entity, dimension, value, onChange, id, 'aria-labelledby': ariaLabelledBy }: KpiDimensionValueFieldProps) {
  const { t } = useTranslation(['settings', 'common'])
  const { options, loading, supported } = useKpiDimensionValues(entity, dimension)
  // 'all' never renders this field at all — the caller (KpiDefinitionForm) already
  // gates on dimension !== 'all', but an unsupported dimension is a defensive no-op too.
  if (!supported) return null
  return (
    <SelectField
      id={id}
      aria-labelledby={ariaLabelledBy}
      value={value ?? ''}
      // An explicit clear means "every value" (fan-out) — never a re-injected sentinel.
      onChange={v => onChange(v || null)}
      options={options}
      placeholder={loading ? t('common:loading') : t('settings:kpiBuilder.placeholder.dimensionValue')}
      clearable
    />
  )
}
