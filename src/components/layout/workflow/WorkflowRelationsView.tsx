/**
 * WorkflowRelationsView — the editor's RELATIES tab (WF-RELATIONS-FE-1): the
 * Make-style parent/child tree for this workflow (GET /workflows/{id}/relations)
 * — a status pill, run count, last run (DD-MM-YYYY HH:mm) and an active toggle
 * (the existing workflow update call) per row, click-through into that
 * workflow's own editor. Four UI states; each list renders independently since
 * a workflow can have parents with no children or vice versa.
 */
import { GitBranch, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWorkflowRelations } from './useWorkflowRelations'
import { PageTitle, SectionTitle, Caption } from '@/components/ui/typography'
import EntityLink from '@/components/ui/EntityLink'
import StatusPill from '@/components/ui/StatusPill'
import { StatusBadge } from '@/components/reports/runFormat'
import Toggle from '@/components/ui/Toggle'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { useDateFormat } from '@/lib/datetime'
import type { WorkflowRelation } from '@/types/workflow'

// A related workflow's OWN status (active/inactive/draft) — success tint when
// active, neutral otherwise; mirrors the editor header's own status colours.
function relationStatusColor(status?: string) {
  return status === 'active' ? 'var(--color-success)' : 'var(--text-muted)'
}

// One parent/child row: name (deep-links into that workflow's editor), status,
// run count, last run, and the active toggle.
function RelationRow({ row, onToggle }: { row: WorkflowRelation; onToggle: () => void }) {
  const { t } = useTranslation('workflows')
  const { formatDate, formatTime } = useDateFormat()
  const active = row.status === 'active'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <EntityLink page="aiagents" id={row.id}>{row.name ?? String(row.id)}</EntityLink>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <StatusPill label={t(active ? 'status.active' : 'status.inactive')} color={relationStatusColor(row.status)} />
          <Caption>{t('relations.runsCount', { count: row.runs_count ?? 0 })}</Caption>
          {row.last_run_at && (
            <Caption>{t('relations.lastRun', { date: formatDate(row.last_run_at), time: formatTime(row.last_run_at) })}</Caption>
          )}
          {row.last_run_status && <StatusBadge status={row.last_run_status} />}
        </div>
      </div>
      {/* §4: the active workflow toggle is a success surface. */}
      <Toggle tone="success" checked={active} onChange={onToggle}
        ariaLabel={t(active ? 'list.setInactive' : 'list.setActive')}
        title={t(active ? 'list.setInactive' : 'list.setActive')} />
    </div>
  )
}

// One "Ouders"/"Kinderen" section — an honest empty line when there are none.
function RelationSection({ title, Icon, rows, emptyLabel, onToggle }: {
  title: string
  Icon: typeof GitBranch
  rows: WorkflowRelation[]
  emptyLabel: string
  onToggle: (row: WorkflowRelation) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Icon size={14} color="var(--text-muted)" />
        <SectionTitle as="span">{title}</SectionTitle>
      </div>
      {rows.length === 0
        ? <Caption>{emptyLabel}</Caption>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(row => <RelationRow key={row.id} row={row} onToggle={() => onToggle(row)} />)}
          </div>}
    </div>
  )
}

export default function WorkflowRelationsView({ workflowId }: { workflowId?: string | number }) {
  const { t } = useTranslation('workflows')
  const { parents, children, loading, error, retry, toggleStatus } = useWorkflowRelations(workflowId)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <GitBranch size={16} color="var(--color-primary)" />
          <PageTitle>{t('relations.title')}</PageTitle>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
            <Spinner size={15} /> {t('relations.loading')}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <ErrorBanner onRetry={retry}>{t('relations.loadFailed')}</ErrorBanner>
        )}

        {/* Success (incl. the honest empty case per section) */}
        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <RelationSection title={t('relations.parents')} Icon={ArrowUpFromLine} rows={parents}
              emptyLabel={t('relations.noParents')} onToggle={row => toggleStatus(row, 'parents')} />
            <RelationSection title={t('relations.children')} Icon={ArrowDownToLine} rows={children}
              emptyLabel={t('relations.noChildren')} onToggle={row => toggleStatus(row, 'children')} />
          </div>
        )}
      </div>
    </div>
  )
}
