/**
 * SettingsFormRow — the labelled row shared by every settings company-profile
 * form (CompanySettings, InvoiceCompanySettings, …): a fixed-width label on
 * the left, the field on the right, and a bottom divider unless it is the
 * last row in its block. Module-scope so the identity stays stable across
 * renders (a per-render Row would drop text-input focus on every keystroke).
 */
import type { ReactNode } from 'react'

// One labelled settings row; `last` drops the divider on a block's closing row.
// `htmlFor` (§6 every input needs a real label association) renders a real
// <label> tied to the caller's field id instead of a plain <div> — optional so
// existing callers that pass no id keep the current (unassociated) render.
interface SettingsFormRowProps {
  label: ReactNode
  children: ReactNode
  last?: boolean
  htmlFor?: string
}
export default function SettingsFormRow({ label, children, last = false, htmlFor }: SettingsFormRowProps) {
  const labelStyle = { width: 200, flexShrink: 0, fontSize: 13, color: 'var(--text-muted)', paddingTop: 8 }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 0', borderBottom: last ? 'none' : '1px solid var(--hover-bg)', gap: 24 }}>
      {htmlFor
        ? <label htmlFor={htmlFor} style={labelStyle}>{label}</label>
        : <div style={labelStyle}>{label}</div>}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}
