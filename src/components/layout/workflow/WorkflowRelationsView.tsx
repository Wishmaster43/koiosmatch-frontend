/**
 * WorkflowRelationsView — the editor's RELATIES tab (WF-RELATIONS-FE-1): the
 * Make-style parent/child tree for this workflow (GET /workflows/{id}/relations)
 * — a status pill, run count, last run (DD-MM-YYYY HH:mm) and an active toggle
 * (the existing workflow update call) per row, click-through into that
 * workflow's own editor. Four UI states; each list renders independently since
 * a workflow can have parents with no children or vice versa.
 */
import { useState } from 'react'
import { GitBranch, ArrowDownToLine, ArrowUpFromLine, ListOrdered, ChevronRight, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWorkflowRelations, useWorkflowChildren } from './useWorkflowRelations'
import Button from '@/components/ui/Button'
import { PageTitle, SectionTitle, Caption } from '@/components/ui/typography'
import EntityLink from '@/components/ui/EntityLink'
import StatusPill from '@/components/ui/StatusPill'
import SoftChip from '@/components/ui/SoftChip'
import { StatusBadge } from '@/components/reports/runFormat'
import Toggle from '@/components/ui/Toggle'
import ErrorBanner from '@/components/ui/ErrorBanner'
import Spinner from '@/components/ui/Spinner'
import { useDateFormat } from '@/lib/datetime'
import { useWorkflowQueueBadge } from '@/pages/ai/shared'
import type { WorkflowRelation } from '@/types/workflow'

// WF-WACHTRIJ-FE-1: how many queue entries this related workflow currently has
// (K-171). Renders NOTHING at 0/null — a badge that always shows "0" is noise,
// not information (the same rule QuickViewToggle counts already follow).
function QueueBadge({ workflowId }: { workflowId?: string | number }) {
  const { t } = useTranslation('workflows')
  // The queue endpoint validates workflow_id as uuid — coerce, never a number.
  const count = useWorkflowQueueBadge(workflowId != null ? String(workflowId) : undefined)
  if (!count) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <ListOrdered size={10} color="var(--color-info)" />
      <SoftChip label={t('queue.relationBadge', { count })} color="var(--color-info)" round size={11} />
    </span>
  )
}

// A related workflow's OWN status (active/inactive/draft) — success tint when
// active, neutral otherwise; mirrors the editor header's own status colours.
function relationStatusColor(status?: string) {
  return status === 'active' ? 'var(--color-success)' : 'var(--text-muted)'
}

// One parent/child row: name (deep-links into that workflow's editor), status,
// run count, last run, and the active toggle.
function RelationRow({ row, onToggle, expander }: { row: WorkflowRelation; onToggle: () => void; expander?: React.ReactNode }) {
  const { t } = useTranslation('workflows')
  const { formatDate, formatTime } = useDateFormat()
  const active = row.status === 'active'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
      {expander}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <EntityLink page="aiagents" id={row.id}>{row.name ?? String(row.id)}</EntityLink>
          {/* WF-RELATIONS-BOOM-1: the at-a-glance warning marker on a failing
              relation — icon + title/aria, never colour alone (§6). */}
          {row.last_run_status === 'failed' && (
            <span title={t('relations.childFailing')} style={{ display: 'inline-flex' }}>
              <AlertTriangle size={13} color="var(--color-danger-text)" role="img"
                aria-label={t('relations.childFailing')} />
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          <StatusPill label={t(active ? 'status.active' : 'status.inactive')} color={relationStatusColor(row.status)} />
          <Caption>{t('relations.runsCount', { count: row.runs_count ?? 0 })}</Caption>
          {row.last_run_at && (
            <Caption>{t('relations.lastRun', { date: formatDate(row.last_run_at), time: formatTime(row.last_run_at) })}</Caption>
          )}
          {row.last_run_status && <StatusBadge status={row.last_run_status} />}
          <QueueBadge workflowId={row.id} />
        </div>
      </div>
      {/* §4: the active workflow toggle is a success surface. */}
      <Toggle tone="success" checked={active} onChange={onToggle}
        ariaLabel={t(active ? 'list.setInactive' : 'list.setActive')}
        title={t(active ? 'list.setInactive' : 'list.setActive')} />
    </div>
  )
}

// WF-RELATIONS-BOOM-1 (Danny 27-08): one child node in the recursive Make-style
// tree — its own row plus a lazily loaded branch of ITS children. `branch`
// carries every workflow id from the root down to here, so a cycle stops the
// recursion with an honest marker instead of looping.
function ChildNode({ row, branch, onToggle }: { row: WorkflowRelation; branch: ReadonlySet<string>; onToggle: () => void }) {
  const { t } = useTranslation('workflows')
  const [open, setOpen] = useState(false)
  const isCycle = branch.has(String(row.id))
  const expander = isCycle
    ? (
      <span title={t('relations.cycle')} style={{ width: 28, display: 'inline-flex', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <GitBranch size={12} role="img" aria-label={t('relations.cycle')} />
      </span>
    ) : (
      <Button variant="ghost" iconOnly size="sm" aria-expanded={open}
        aria-label={t(open ? 'relations.collapse' : 'relations.expand')}
        onClick={() => setOpen(v => !v)}>
        <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform var(--motion-fast)' }} />
      </Button>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <RelationRow row={row} onToggle={onToggle} expander={expander} />
      {open && !isCycle && <ChildBranch parentId={row.id} branch={new Set([...branch, String(row.id)])} />}
    </div>
  )
}

// The lazily fetched branch under an expanded node — its own three states,
// indented one step per depth; rows recurse via ChildNode again.
function ChildBranch({ parentId, branch }: { parentId: string | number; branch: ReadonlySet<string> }) {
  const { t } = useTranslation('workflows')
  const { rows, loading, error, toggleRow } = useWorkflowChildren(parentId, true)
  return (
    <div style={{ marginLeft: 26, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {loading && <Caption>{t('relations.loading')}</Caption>}
      {!loading && error && <ErrorBanner variant="subtle">{t('relations.loadFailed')}</ErrorBanner>}
      {!loading && !error && rows.length === 0 && <Caption>{t('relations.noChildren')}</Caption>}
      {!loading && !error && rows.map(r => (
        <ChildNode key={r.id} row={r} branch={branch} onToggle={() => toggleRow(r)} />
      ))}
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

// The editor's RELATIES tab: parent/child workflow lists with their own status,
// run stats and active toggle, each list rendering its own honest empty state.
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
            {/* Children render as the recursive tree (WF-RELATIONS-BOOM-1); parents
                stay flat — upward chains read better as a plain list. */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <ArrowDownToLine size={14} color="var(--text-muted)" />
                <SectionTitle as="span">{t('relations.children')}</SectionTitle>
              </div>
              {children.length === 0
                ? <Caption>{t('relations.noChildren')}</Caption>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {children.map(row => (
                      <ChildNode key={row.id} row={row}
                        branch={new Set([String(workflowId ?? '')])}
                        onToggle={() => toggleStatus(row, 'children')} />
                    ))}
                  </div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
