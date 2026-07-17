import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

// One transient success/error message for a list page (bulk mutation feedback).
// `action` is an optional inline follow-up (e.g. "Openen" after a restore).
export interface ActionMessage {
  type: string
  text: string
  action?: { label: string; onClick: () => void }
}

interface ActionMessageBannerProps {
  msg: ActionMessage | null
  onDismiss: () => void
  // Caller-translated aria-label for the close (X) button — this stays a dumb
  // component (§3), so it never imports i18n itself.
  dismissLabel: string
}

/**
 * ActionMessageBanner — the ONE transient action-feedback banner for every
 * entity list page. It was copy-pasted verbatim (role="status" + aria-live +
 * success/error styling + optional inline action) across CandidatesPage,
 * CustomersPage and VacanciesPage — this is the single source going forward.
 * Clicking the text or the action button both run the action then dismiss the
 * banner (mirrors the original per-page behaviour); the close (X) only dismisses.
 */
export default function ActionMessageBanner({ msg, onDismiss, dismissLabel }: ActionMessageBannerProps) {
  if (!msg) return null
  const isError = msg.type === 'error'
  const color = isError ? 'var(--color-danger)' : 'var(--color-success)'
  const bg = isError ? 'var(--color-danger-bg)' : 'var(--color-success-bg)'
  // Action + dismiss are chained so the banner clears itself once the follow-up ran.
  const runAction = () => { msg.action?.onClick(); onDismiss() }

  return (
    <div role="status" aria-live="polite" style={{ margin: '0 24px 10px', display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px', borderRadius: 8, fontSize: 12.5, background: bg, color, border: `1px solid ${color}` }}>
      {isError ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
      {/* Whole text is a click target when an action exists (Danny 13/7). */}
      <span style={{ flex: 1, cursor: msg.action ? 'pointer' : 'default', textDecoration: msg.action ? 'underline' : 'none' }}
        onClick={msg.action ? runAction : undefined}>{msg.text}</span>
      {/* Optional action (e.g. "Openen" after a restore) — underlined link-button. */}
      {msg.action && (
        <button onClick={runAction}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', color: 'inherit' }}>
          {msg.action.label}
        </button>
      )}
      <button onClick={onDismiss} aria-label={dismissLabel}
        style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
        <X size={13} />
      </button>
    </div>
  )
}
