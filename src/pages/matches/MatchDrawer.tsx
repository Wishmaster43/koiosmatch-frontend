/**
 * MatchDrawer — the read-only drill-down for one match, built on the shared
 * EntityDrawer + EntityHeader shell (§3A blueprint). A match is the continuation
 * of an application → placement (§3B), so this drawer only *renders*: no meta
 * pickers, no onUpdate, no edit. It is a thin container — header config + tab
 * list; all body markup lives in the tab components.
 */
import { useTranslation } from 'react-i18next'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import StatusPill from '@/components/ui/StatusPill'
import ScorePill from './ScorePill'
import OverviewTab from './drawer/OverviewTab'
import type { MatchRow } from '@/types/match'

interface MatchDrawerProps {
  match: MatchRow | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
}

export default function MatchDrawer({ match, onClose, expanded = false, onToggleExpand }: MatchDrawerProps) {
  const { t } = useTranslation('matches')
  if (!match) return null

  // Read-only chip row shown under the title (score · stage · owner).
  const headerChips = (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      <ScorePill value={match.score} />
      {match.stage && <StatusPill label={match.stage} color={match.stageColor} />}
      {match.owner && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{match.owner}</span>}
    </div>
  )

  // Tabs are config; today one read-only Overview. Placement/Changelog land once
  // the backend exposes GET /matches/{id} (+ /activity) — see docs/DATA-API.md.
  const tabs: EntityTab[] = [
    { id: 'overview', label: t('drawer.tabs.overview'), render: () => <OverviewTab match={match} /> },
  ]

  return (
    <EntityDrawer
      entity={{ id: match.id }}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      header={
        <EntityHeader
          label={t('drawer.label')}
          avatar={{ initials: match.initials, soft: true }}
          title={match.candidate}
          subtitle={[match.vacancy, match.client].filter(v => v && v !== '—').join(' · ')}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
        >
          {headerChips}
        </EntityHeader>
      }
      tabs={tabs}
    />
  )
}
