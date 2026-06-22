import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import EntityDrawer from '../../components/drawer/EntityDrawer'
import EntityHeader from '../../components/drawer/EntityHeader'
import { useVacancyLookups } from '../../context/VacancyLookupsContext'
import { useDateFormat } from '../../lib/datetime'
import DetailsTab from './drawer/DetailsTab'
import ApplicantsTab from './drawer/ApplicantsTab'
import PublishingTab from './drawer/PublishingTab'
import DocumentsTab from './drawer/DocumentsTab'
import TimelineTab from './drawer/TimelineTab'
import NotesTab from './drawer/NotesTab'
import StatisticsTab from './drawer/StatisticsTab'
import MatchingTab from './drawer/MatchingTab'

// Tab list — config only; each renders one small component (one per tab/section).
const TABS = [
  { id: 'details',    tKey: 'details',    render: (v) => <DetailsTab vacancy={v} /> },
  { id: 'applicants', tKey: 'applicants', render: (v) => <ApplicantsTab vacancy={v} /> },
  { id: 'matching',   tKey: 'matching',   render: (v, onUpdate) => <MatchingTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'publishing', tKey: 'publishing', render: (v, onUpdate) => <PublishingTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'documents',  tKey: 'documents',  render: (v) => <DocumentsTab vacancy={v} /> },
  { id: 'timeline',   tKey: 'timeline',   render: (v) => <TimelineTab vacancy={v} /> },
  { id: 'notes',      tKey: 'notes',      render: (v) => <NotesTab vacancy={v} /> },
  { id: 'statistics', tKey: 'statistics', render: (v) => <StatisticsTab vacancy={v} /> },
]

/**
 * VacancyDrawer — thin container: wires data (lookups + onUpdate) and declares the
 * header config + tab list. No heavy JSX, no business logic (mirror CandidateDrawer).
 */
export default function VacancyDrawer({ vacancy: v, onClose, expanded, onToggleExpand, onUpdate, users = [], customers = [] }) {
  const { t } = useTranslation('vacancies')
  const { statuses } = useVacancyLookups()
  const { formatDate } = useDateFormat()

  // Tags are edited inline; seed from the record and reset when a different
  // vacancy is shown (adjust state during render — React's recommended pattern).
  const [tags, setTags] = useState(null)
  const [prevId, setPrevId] = useState(v?.id)
  if (v?.id !== prevId) { setPrevId(v?.id); setTags(null) }

  if (!v) return null

  const currentTags = tags ?? v.tags ?? []
  const setTagsAndSave = (next) => { setTags(next); onUpdate?.(v.id, { tags: next }) }

  // Owner picker — include the current owner so it shows even if not in `users`.
  const ownerOptions = [
    ...(users.some(u => u.id === v.owner?.id) || !v.owner?.name ? [] : [{ value: v.owner.id, label: v.owner.name }]),
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]
  const clientOptions = customers.map(c => ({ value: c.id, label: c.name }))

  return (
    <EntityDrawer
      entity={v}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: formatDate(v.created) || '—' })}</span>}
      tabs={TABS.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), render: () => tab.render(v, onUpdate) }))}
      header={() => (
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: (v.clientName?.[0] ?? v.title?.[0] ?? '?').toUpperCase(), soft: true }}
          title={v.title}
          subtitle={v.clientName || '—'}
          meta={[
            { key: 'status', label: t('drawer.status'), value: v.statusValue,
              options: statuses.map(s => ({ value: s.value, label: s.label })),
              onChange: (val) => onUpdate?.(v.id, { statusValue: val }), menuWidth: 160, width: 150 },
            { key: 'owner', label: t('drawer.owner'), value: v.owner?.id,
              options: ownerOptions, onChange: (val) => onUpdate?.(v.id, { ownerId: val }), menuWidth: 200, width: 180 },
            { key: 'client', label: t('drawer.client'), value: v.clientId,
              options: clientOptions, placeholder: t('drawer.selectClient'),
              onChange: (val) => onUpdate?.(v.id, { clientId: val }), menuWidth: 220, width: 200 },
          ]}
          tags={{ items: currentTags, onAdd: tag => setTagsAndSave([...currentTags, tag]),
            onRemove: tag => setTagsAndSave(currentTags.filter(x => x !== tag)), addLabel: t('drawer.tags') }}
          tagsLabel={t('drawer.tags')}
        >
          {/* Published indicator — icon + text (colour is never the only signal). */}
          <div style={{ fontSize: 11, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
            color: v.published ? 'var(--color-success)' : 'var(--text-muted)' }}>
            <Globe size={13} />
            {v.published ? t('drawer.published') : t('drawer.notPublished')}
          </div>
        </EntityHeader>
      )}
    />
  )
}
