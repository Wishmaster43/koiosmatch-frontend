/**
 * DefaultChoiceCard — reusable settings card for tenant-configurable choices,
 * saved through saveSettingsKeys. Renders a title, hint text, and a custom control
 * (SearchSelect, SegmentedControl, Toggle, etc.). Handles permission gating and
 * error display. Differences in how the control saves (single key, multiple keys,
 * value type) are passed as props: a single-key choice passes onSave(value), while
 * multi-field cards call onSave(key, value) separately per field. The error's own
 * markup differs per consumer on main (KoiosEffortDefaultCard: a `<div role="status">`
 * at 12px; KoiosModeDefaultCard: a plain `<Caption>` span at 11px with no role) so it
 * rides as a `renderError` slot rather than being unified on one copy (rule B/F).
 */
import { ReactNode } from 'react'
import { SectionTitle, Caption } from '@/components/ui/typography'

export interface DefaultChoiceCardProps {
  title: ReactNode
  hint?: ReactNode
  children: ReactNode
  error?: string | null
  renderError?: (error: string) => ReactNode
}

// Reusable card shell: title + optional hint + children + error display.
export function DefaultChoiceCard({
  title,
  hint,
  children,
  error,
  renderError,
}: DefaultChoiceCardProps) {
  const card = {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 16,
    marginBottom: 14,
    background: 'var(--surface)',
  }

  return (
    <div style={card}>
      <SectionTitle>{title}</SectionTitle>
      {hint && (
        <Caption style={{ display: 'block', margin: '4px 0 12px' }}>
          {hint}
        </Caption>
      )}

      {children}

      {/* Default reproduces KoiosEffortDefaultCard's original error markup; a consumer
          whose own error looked different on main (KoiosModeDefaultCard) passes renderError. */}
      {error && (renderError ? renderError(error) : (
        <div
          role="status"
          style={{
            display: 'block',
            marginTop: 6,
            color: 'var(--color-danger-text)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ))}
    </div>
  )
}
