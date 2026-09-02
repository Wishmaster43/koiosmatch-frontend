/**
 * RunLineage — WF-RELATIONS-FE-1's run-detail lineage: when this run was
 * started by a parent workflow (via the workflow_call module), show the call
 * chain as clickable breadcrumbs (root workflow first, each linking into that
 * workflow's own editor) plus the specific parent run id. Read tolerantly from
 * either the run's own `context` object or promoted top-level fields — the
 * contract names "the run's context" but the exact read shape isn't pinned by
 * the API docs, so both are honoured. Renders nothing for a root-level run
 * (no parent) — the honest empty case, never a placeholder row.
 * CONTRACT-PENDING (RUN-LINEAGE-CONTRACT-1): RunPresenter::format does not
 * emit parent_run_id/parent_workflow_id/call_chain yet (they live on the run's
 * raw context, set by WorkflowCallModule) — until CMBE adds them, every real
 * run renders nothing here. The read below already matches the engine's field
 * names, so this lights up the moment the presenter ships them.
 *
 * K-254 (WF-RELATIONS-FE-2): below the breadcrumb, a "Kind-runs" list renders
 * when `child_runs` (GET /workflow-runs/{id} detail only) is non-empty — status
 * badge + a short mono id. NOT clickable: there is no run deep-link route yet,
 * so this is a status glance only, never a fake affordance (§3).
 */
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import EntityLink from '@/components/ui/EntityLink'
import { GroupLabel, Mono, Caption } from '@/components/ui/typography'
import { StatusBadge } from './runFormat'
import type { RunRow } from '@/types/reports'

// One call-chain entry can arrive as a bare id or an {id, name} object.
type ChainEntry = { id?: string | number; name?: string } | string | number
const asEntry = (e: ChainEntry) => (typeof e === 'object' && e != null) ? e : { id: e }

// Renders a workflow run's parent→child call chain as a breadcrumb trail, each entry deep-linking to its own run.
export default function RunLineage({ run }: { run: RunRow }) {
  const { t } = useTranslation('reports')
  const ctx = run.context ?? {}
  const parentRunId = run.parent_run_id ?? ctx.parent_run_id ?? null
  const chain = run.call_chain ?? ctx.call_chain ?? []
  const childRuns = run.child_runs ?? []
  if (parentRunId == null && chain.length === 0 && childRuns.length === 0) return null

  const entries = chain.map(asEntry)
  return (
    <div style={{ marginBottom: 20 }}>
      <GroupLabel style={{ marginBottom: 8 }}>{t('runs.drawer.lineage')}</GroupLabel>
      {entries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {entries.map((e, i) => (
            <span key={`${e.id ?? i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <ChevronRight size={11} color="var(--text-muted)" />}
              <EntityLink page="aiagents" id={e.id}>{e.name ?? String(e.id)}</EntityLink>
            </span>
          ))}
        </div>
      )}
      {parentRunId != null && (
        <Caption as="div" style={{ marginTop: 6 }}>
          {t('runs.drawer.parentRunId')}: <Mono>{String(parentRunId)}</Mono>
        </Caption>
      )}
      {childRuns.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <GroupLabel style={{ marginBottom: 6 }}>{t('runs.drawer.childRuns')}</GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {childRuns.map((c, i) => (
              <div key={c.id != null ? String(c.id) : i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {c.status && <StatusBadge status={c.status} />}
                {c.id != null && <Mono>{String(c.id).slice(0, 8)}</Mono>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
