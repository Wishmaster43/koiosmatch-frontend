/**
 * buildReportFilterGroups — shared filter-group builder for DepartmentsTable and
 * LocationsTable. Generates the customer and status filter definitions with live
 * per-option counts. Config specifies field names and label translation keys.
 */
import type { TFunction } from 'i18next'

interface FilterGroupConfig {
  customerLabelKey: string // e.g. 'departments.filters.customer'
  statusLabelKey: string // e.g. 'departments.filters.locationStatus'
  customerFieldKey: string // e.g. 'customer_id'
  statusFieldKey: string // e.g. 'location_status'
}

interface FilterableRow {
  [key: string]: unknown
}

export function buildReportFilterGroups<T extends FilterableRow>({
  t,
  rows,
  customerOptions,
  statusOptions,
  selectedCustomers,
  selectedStatuses,
  onToggleCustomer,
  onToggleStatus,
  config,
}: {
  t: TFunction
  rows: T[]
  customerOptions: Array<{ id: string | number; name?: string }>
  statusOptions: Array<string>
  selectedCustomers: Array<string | number>
  selectedStatuses: Array<string | number>
  onToggleCustomer: (value: string | number) => void
  onToggleStatus: (value: string | number) => void
  config: FilterGroupConfig
}) {
  return [
    {
      key: 'customer',
      label: t(config.customerLabelKey),
      type: 'search-select',
      selected: selectedCustomers,
      options: customerOptions.map((c) => ({
        value: c.id,
        label: c.name || '',
        count: rows.filter((r) => r[config.customerFieldKey] === c.id).length,
      })),
      onToggle: onToggleCustomer,
    },
    {
      key: 'status',
      label: t(config.statusLabelKey),
      selected: selectedStatuses,
      options: statusOptions.map((s) => ({
        value: s,
        label: s === 'active' ? t('common.statusActive') : s === 'inactive' ? t('common.statusInactive') : s,
        count: rows.filter((r) => r[config.statusFieldKey] === s).length,
      })),
      onToggle: onToggleStatus,
    },
  ]
}
