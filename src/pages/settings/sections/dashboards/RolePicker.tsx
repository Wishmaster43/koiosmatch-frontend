/**
 * RolePicker — the role switcher on top of Settings → Dashboards (F6 rebuild:
 * "one role at a time"). All ten DASHBOARD_TYPES stay configurable here (the
 * live-switcher's `switcherTypes` deliberately drops admin/sales/readonly from
 * the end-user dropdown, but a tenant admin must still be able to configure
 * those roles' dashboards — see DEVIATIONS in the delivery report), ordered
 * exactly as DASHBOARD_TYPES/TYPE_PRECEDENCE already do.
 */
import SegmentedControl from '@/components/ui/SegmentedControl'
import { DASHBOARD_TYPES, type DashboardType } from '@/pages/dashboard/shared'
import type { TFunction } from 'i18next'

interface RolePickerProps {
  value: DashboardType
  onChange: (role: DashboardType) => void
  td: TFunction
  ariaLabel: string
}

export default function RolePicker({ value, onChange, td, ariaLabel }: RolePickerProps) {
  // One option per dashboard type, label from the `dashboard` namespace (same
  // types.* keys the live switcher and the old matrix header already use).
  const options = DASHBOARD_TYPES.map(type => ({ value: type, label: td(`types.${type}`) }))
  return (
    <SegmentedControl
      options={options}
      value={value}
      onChange={val => onChange(val as DashboardType)}
      size="compact"
      ariaLabel={ariaLabel}
    />
  )
}
