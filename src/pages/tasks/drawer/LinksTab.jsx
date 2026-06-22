import { useTranslation } from 'react-i18next'
import { Link2 } from 'lucide-react'

/**
 * LinksTab — the polymorphic entities a task is linked to (candidate, application,
 * vacancy, match, customer, location, department, contact, workflow). Read-only
 * list grouped per entity; the type label comes from i18n, never hardcoded copy.
 */
export default function LinksTab({ task }) {
  const { t } = useTranslation('tasks')
  const links = task.links ?? []

  // Translated label for a link type, falling back to the raw type if unknown.
  const typeLabel = (type) => t(`links.${type}`, { defaultValue: type })

  if (links.length === 0) {
    return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('links.empty')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {links.map((l, i) => (
        <div key={l.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary)' }}>
            <Link2 size={15} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              {typeLabel(l.type)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l.label || '—'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
