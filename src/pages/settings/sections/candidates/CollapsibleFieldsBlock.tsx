/**
 * CollapsibleFieldsBlock — the shell one block of the candidate required-fields editor
 * renders in: a keyboard-operable header (title + "x van y verplicht" counter + chevron)
 * over a collapsible body. Extracted because the screen now carries ~30 built-in fields
 * plus the tenant's own fields; one long table would be unreadable (§3 size discipline),
 * and both the built-in groups and the custom-fields block need the exact same shell.
 *
 * The header is a real <button aria-expanded aria-controls> (§6): reachable by Tab,
 * operated by Enter/Space for free, and announced as expanded/collapsed — never a
 * clickable <div>.
 */
import { useId, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function CollapsibleFieldsBlock({ title, requiredCount, total, open, onToggle, children }: {
  /** Already-translated block title. */
  title: string
  /** How many fields in this block are required in at least one phase. */
  requiredCount: number
  /** How many fields the block holds in total. */
  total: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { t } = useTranslation('settings')
  const bodyId = useId()

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header: title on the left, counter on the right — the counter makes a long
          screen scannable without expanding every block. */}
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={bodyId}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                 background: 'var(--bg)', border: 'none', borderBottom: open ? '1px solid var(--border)' : 'none',
                 cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
        {open
          ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
          : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{title}</span>
        {/* Named vars, not `count` — this string never varies by plural, and `count`
            would force i18next to demand _one/_other variants of the same sentence
            (matches reports:summary "{{shown}} van {{total}}"). */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {t('requiredFields.groupCount', { required: requiredCount, total })}
        </span>
      </button>

      {/* Body stays unmounted while collapsed — nothing to tab through when hidden. */}
      {open && <div id={bodyId}>{children}</div>}
    </div>
  )
}
