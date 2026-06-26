import { useTranslation } from 'react-i18next'
import EntityDrawer from '../../components/drawer/EntityDrawer'
import EntityHeader from '../../components/drawer/EntityHeader'
import { useDateFormat } from '../../lib/datetime'
import DetailsTab from './drawer/DetailsTab'
import LinksTab from './drawer/LinksTab'
import CommentsTab from './drawer/CommentsTab'
import ActivityTab from './drawer/ActivityTab'

import { initialsOf } from '@/lib/initials'

// The tab order (mirrors the candidate/application drawer blueprint — all tabs).
const TAB_IDS = ['details', 'links', 'comments', 'activity']

/**
 * TaskDrawer — thin container: declares the header config + tab list and wires them
 * to the shared EntityDrawer shell. No heavy JSX, no business logic (the page owns
 * the data + mutations via onUpdate / onAddComment).
 */
export default function TaskDrawer({ task, onClose, expanded, onToggleExpand, onUpdate, onAddComment, onAddLink, onRemoveLink }) {
  const { t } = useTranslation('tasks')
  const { formatDate } = useDateFormat()
  if (!task) return null

  // Map a tab id to its content component.
  const renderTab = (id) => {
    switch (id) {
      case 'details':  return <DetailsTab task={task} onUpdate={(patch) => onUpdate(task.id, patch)} />
      case 'links':    return <LinksTab task={task} onAddLink={(link) => onAddLink(task.id, link)} onRemoveLink={(link) => onRemoveLink(task.id, link)} />
      case 'comments': return <CommentsTab task={task} onAdd={(body) => onAddComment(task.id, body)} />
      case 'activity': return <ActivityTab task={task} />
      default:         return null
    }
  }

  // Per-tab badge counts (links + comments).
  const badgeFor = (id) =>
    id === 'links'    ? (task.links?.length || undefined)
  : id === 'comments' ? ((task.comments?.length ?? task.commentCount) || undefined)
  : undefined

  return (
    <EntityDrawer
      entity={task}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: task.createdAt ? formatDate(task.createdAt) : '—' })}</span>}
      tabs={TAB_IDS.map(id => ({ id, label: t(`drawer.tabs.${id}`), badge: badgeFor(id), render: () => renderTab(id) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.label')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: initialsOf(task.title, 'T'), soft: true, color: task.statusColor }}
          title={task.title}
          subtitle={task.typeLabel || ''}
        />
      )}
    />
  )
}
