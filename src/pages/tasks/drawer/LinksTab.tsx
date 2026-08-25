/**
 * LinksTab — the polymorphic entities a task is linked to. Lists the current links
 * with a remove (×) per row and an inline "add link" row. Mutations go through the
 * page (onAddLink / onRemoveLink → POST|DELETE /tasks/{id}/links). The type label
 * comes from i18n, never hardcoded.
 *
 * The vocabulary + the picker row itself now live in `../links/` (shared with the
 * CREATE form since Danny 08-08 punt 15) — this tab is the list + mutations only.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link2, X } from 'lucide-react'
import EntityLink from '@/components/ui/EntityLink'
import AddLinkRow from '../links/AddLinkRow'
import type { NewLink } from '../links/AddLinkRow'
import { TASK_LINK_PAGE } from '../links/taskLinkTypes'
import type { TaskDetail } from '@/types/task'
import type { Id } from '@/types/common'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'

export default function LinksTab({ task, onAddLink, onRemoveLink }: {
  task: TaskDetail; onAddLink: (link: NewLink) => void; onRemoveLink: (link: { type: string; id: Id | null }) => void
}) {
  const { t } = useTranslation('tasks')
  const [adding, setAdding] = useState(false)
  const links = task.links ?? []
  const typeLabel = (type: string) => t(`links.${type}`, { defaultValue: type })

  return (
    <div>
      {/* Add control */}
      {adding ? (
        <AddLinkRow existing={links} onAdd={onAddLink} onClose={() => setAdding(false)} />
      ) : (
        // HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A).
        <div style={{ marginBottom: 12 }}>
          <DrawerAddButton onClick={() => setAdding(true)} label={t('links.add')} />
        </div>
      )}

      {/* Existing links */}
      {links.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('links.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {links.map((l, i) => (
            <div key={`${l.type}-${l.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}>
                <Link2 size={15} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                  {typeLabel(l.type)}
                </div>
                {/* Click through to the linked record's own drawer (intent navigation). */}
                <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <EntityLink page={TASK_LINK_PAGE[l.type] ?? ''} id={TASK_LINK_PAGE[l.type] ? l.id : null} title={t('links.open')}>
                    {l.label || '—'}
                  </EntityLink>
                </div>
              </div>
              <button onClick={() => onRemoveLink({ type: l.type, id: l.id })} title={t('links.remove')} aria-label={t('links.remove')}
                style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: 'var(--color-danger-bg)', border: 'none', borderRadius: 6, color: 'var(--color-on-danger-bg)', cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
