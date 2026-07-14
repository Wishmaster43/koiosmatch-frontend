import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import VacancyChangelogPopover from './drawer/VacancyChangelogPopover'
import { useVacancyLookups } from '@/context/VacancyLookupsContext'
import { useDateFormat } from '@/lib/datetime'
import DetailsTab from './drawer/DetailsTab'
import ApplicantsTab from './drawer/ApplicantsTab'
import PublishingTab from './drawer/PublishingTab'
import DocumentsTab from './drawer/DocumentsTab'
import TimelineTab from './drawer/TimelineTab'
import NotesTab from './drawer/NotesTab'
import StatisticsTab from './drawer/StatisticsTab'
import MatchingTab from './drawer/MatchingTab'
import ExtraTab from './drawer/ExtraTab'
import { useVacancyCustomFields } from '@/lib/useVacancyCustomFields'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void
interface DrawerUser { id: Id; name: string }

// Tab list — config only; each renders one small component (one per tab/section).
// Details is the FIRST tab (Danny 2026-07-04 — reverses R-7's pinned-above-the-tabs
// layout: "Details moet gewoon eerste tabje zijn", the pinned editor crowded the drawer).
const TABS: { id: string; tKey: string; render: (v: VacancyDetail, onUpdate?: UpdateFn) => ReactNode }[] = [
  { id: 'details',    tKey: 'details',    render: (v, onUpdate) => <DetailsTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'applicants', tKey: 'applicants', render: v => <ApplicantsTab vacancy={v} /> },
  { id: 'matching',   tKey: 'matching',   render: (v, onUpdate) => <MatchingTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'publishing', tKey: 'publishing', render: (v, onUpdate) => <PublishingTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'extra',      tKey: 'extra',      render: (v, onUpdate) => <ExtraTab vacancy={v} onUpdate={onUpdate} /> },
  { id: 'documents',  tKey: 'documents',  render: v => <DocumentsTab vacancy={v} /> },
  // Tijdlijn TAB (intended: real lifecycle activity — created/status changes/
  // applications received) is distinct BY DESIGN from the changelog ICON in the
  // title row (raw field-change audit, VacancyChangelogPopover) — §3A(d): tab =
  // activiteit, icon = veldwijzigingen. Currently a calm empty state: the backend
  // hardcodes `timeline: []` (no aggregator like ApplicationTimeline exists yet for
  // vacancies) — BE follow-up, not a reason to remove this tab.
  { id: 'timeline',   tKey: 'timeline',   render: v => <TimelineTab vacancy={v} /> },
  { id: 'notes',      tKey: 'notes',      render: v => <NotesTab vacancy={v} /> },
  { id: 'statistics', tKey: 'statistics', render: v => <StatisticsTab vacancy={v} /> },
]

interface VacancyDrawerProps {
  vacancy: VacancyDetail | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  onUpdate?: UpdateFn
  users?: DrawerUser[]
}

/**
 * VacancyDrawer — thin container: wires data (lookups + onUpdate) and declares the
 * header config + tab list. No heavy JSX, no business logic (mirror CandidateDrawer).
 */
export default function VacancyDrawer({ vacancy: v, onClose, expanded, onToggleExpand, onUpdate, users = [] }: VacancyDrawerProps) {
  const { t } = useTranslation('vacancies')
  const { statuses } = useVacancyLookups()
  const { formatDateTime } = useDateFormat()
  // The Extra tab only shows when the tenant has defined vacancy custom fields.
  const { fields: customFieldDefs } = useVacancyCustomFields()
  const visibleTabs = TABS.filter(tab => tab.id !== 'extra' || customFieldDefs.length > 0)

  // Tags are edited inline; seed from the record and reset when a different
  // vacancy is shown (adjust state during render — React's recommended pattern).
  const [tags, setTags] = useState<string[] | null>(null)
  const [prevId, setPrevId] = useState<Id | undefined>(v?.id)
  if (v?.id !== prevId) { setPrevId(v?.id); setTags(null) }

  if (!v) return null

  const currentTags = tags ?? (v.tags as string[]) ?? []
  const setTagsAndSave = (next: string[]) => { setTags(next); onUpdate?.(v.id, { tags: next }) }

  // Owner picker — include the current owner so it shows even if not in `users`.
  const ownerOptions = [
    ...(users.some(u => String(u.id) === String(v.owner?.id)) || !v.owner?.name ? [] : [{ value: v.owner.id, label: v.owner.name }]),
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  return (
    <EntityDrawer
      entity={v}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Two-sided footer (§3A(8)): created-at left, empty right (consistent spacing
      // with the candidate/other drawers even when there is no right-side content).
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(v.created) })}</span>
          <span />
        </div>
      }
      tabs={visibleTabs.map(tab => ({ id: tab.id, label: t(`drawer.tabs.${tab.tKey}`), render: () => tab.render(v, onUpdate) }))}
      header={() => (
        <>
        <EntityHeader
          label={t('drawer.entityLabel')}
          expanded={expanded} onToggleExpand={onToggleExpand} onClose={onClose}
          avatar={{ initials: (v.clientName?.[0] ?? v.title?.[0] ?? '?').toUpperCase(), soft: true }}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{v.title}</span>
                {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
                <ReferenceNumberChip value={v.referenceNumber} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.clientName || '—'}</div>
            </>
          )}
          // Changelog icon (§3A(d)) — GET /vacancies/{id}/activity exists (measured:
          // routes/api/tenant/candidates.php), so this is the missing icon-popover, not a tab.
          titleActions={<VacancyChangelogPopover vacancy={v} />}
          // Standard picker widths (§3A blueprint: Status ~160 + Eigenaar ~190).
          meta={[
            { key: 'status', label: t('drawer.status'), value: v.statusValue,
              options: statuses.map(s => ({ value: s.value, label: s.label })),
              onChange: val => onUpdate?.(v.id, { statusValue: val }), menuWidth: 170, width: 160 },
            // Client moved to the Details tab (P3: calm header — max status + owner,
            // mirror the candidate blueprint §3A(c)); the subtitle still shows it.
            { key: 'owner', label: t('drawer.owner'), value: v.owner?.id,
              options: ownerOptions, onChange: val => onUpdate?.(v.id, { ownerId: val }), menuWidth: 200, width: 190 },
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
        </>
      )}
    />
  )
}
