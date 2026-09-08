/**
 * SaveRow — the shared error-line + save-button row for admin cards.
 * Consolidates the identical 12-line tail from four koiosmodels cards
 * (FlavorsCard, PackagesCard, TenantOverridesCard, RoutingCard), which all
 * render an error div (role=alert) and a SaveButton row with identical styling.
 */
import SaveButton from './SaveButton'

interface SaveRowProps {
  error?: string | null
  saved: boolean
  saving: boolean
  dirty: boolean
  onSave: () => void
  label: string
}

export default function SaveRow({ error, saved, saving, dirty, onSave, label }: SaveRowProps) {
  return (
    <>
      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 10 }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <SaveButton size="sm" saved={saved} disabled={!dirty || saving} onClick={onSave}>
          {label}
        </SaveButton>
      </div>
    </>
  )
}
