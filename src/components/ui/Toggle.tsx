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
  // Optional native tooltip (PermissionToggle/AppsSettings, 05-08): forwarded
  // straight onto the button's `title` attribute — additive, unused by every
  // other existing consumer.
  title?: string
  // On-colour. §4 names "an active workflow toggle" as a SUCCESS surface, so that
  // one consumer passes 'success'; everything else keeps the accent default.
  // Additive — omitting it renders byte-identical to before.
  tone?: 'primary' | 'success'
}

// The switch button itself: toggles on click; its on-colour follows tone (success for the one active-workflow consumer, accent elsewhere).
export default function Toggle({ checked, onChange, ariaLabel, disabled, describedBy, title, tone = 'primary' }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} aria-describedby={describedBy}
      title={title} disabled={disabled} onClick={() => onChange(!checked)}
      style={{ width: 32, height: 18, borderRadius: 999, border: 'none',
               cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
               background: checked ? (tone === 'success' ? 'var(--color-success)' : 'var(--color-primary)') : 'var(--border)', position: 'relative',
               transition: 'background var(--motion-fast)', flexShrink: 0 }}>
      {/* HUISSTIJL-1: tiny thumb shadow, none of card/float/modal — kept as-is */}
      <div style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
                    borderRadius: '50%', background: 'var(--surface)', transition: 'left var(--motion-fast)',
                    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- thumb-class shadow, no card/float/modal tier fits a 14px switch thumb
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}
