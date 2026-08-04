/**
 * Toggle — the ONE toggle-switch implementation in the app. Promoted out of
 * `pages/settings/components/SettingsKit.jsx` (2026-07-28) so non-settings
 * screens (e.g. AddContactPersonModal's "primair contact" flag) can use it
 * without an entity page reaching into another entity page's internals
 * (CLAUDE.md §2). `SettingsKit` re-exports this component under its original
 * `Toggle` name so its ~40 existing consumers keep their import path unchanged.
 */
export interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  ariaLabel?: string
  disabled?: boolean
  // Optional (candidate RetentionConsentBlock, 04-08): forwards aria-describedby
  // to the underlying switch button, so a screen reader reads a validity line
  // right below it as part of the SAME announcement. Additive — every existing
  // consumer that never passes it keeps the exact same markup, unchanged.
  describedBy?: string
}

export default function Toggle({ checked, onChange, ariaLabel, disabled, describedBy }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} aria-describedby={describedBy}
      disabled={disabled} onClick={() => onChange(!checked)}
      style={{ width: 32, height: 18, borderRadius: 999, border: 'none',
               cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
               background: checked ? 'var(--color-primary)' : 'var(--border)', position: 'relative',
               transition: 'background 0.15s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
                    borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}
