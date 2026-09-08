/**
 * SettingLookupPicker — Shared single-value lookup picker with SearchSelect,
 * used by tenant-setting screens (customer/vacancy/candidate conversion status).
 * Composes SearchSelect with a conditional 'none' option, compose with
 * useSettingKeyPick for optimistic save/revert on failure.
 */
import SearchSelect from '@/components/ui/SearchSelect'

export interface SettingLookupPickerProps {
  options: Array<{ value: string; label: string }>
  value: string
  onPick: (next: string) => Promise<void> | void
  disabled?: boolean
  width?: number
  noneLabel: string
}

/**
 * Single-pick lookup picker with 'none' option, wrapping SearchSelect. The
 * conditional save pattern (if (next !== value) save(next)) is caller's
 * responsibility.
 */
export default function SettingLookupPicker({
  options,
  value,
  onPick,
  disabled = false,
  width = 300,
  noneLabel,
}: SettingLookupPickerProps) {
  return (
    <SearchSelect
      closeOnToggle
      width={width}
      disabled={disabled}
      options={[{ value: 'none', label: noneLabel }, ...options]}
      selected={[value]}
      onToggle={(next) => {
        if (next !== value) onPick(next)
      }}
      triggerLabel={
        value === 'none'
          ? noneLabel
          : options.find((s) => s.value === value)?.label ?? value
      }
    />
  )
}
