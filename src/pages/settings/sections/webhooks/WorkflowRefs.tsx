/**
 * WorkflowRefs — the workflows an inbound webhook request dispatched to.
 * WEBHOOK-RUN-CORRELATION-1: the backend now attaches each workflow's NAME (next
 * to its id) and GET /workflow-runs accepts `?workflow_id=`, so a named workflow
 * renders as a REAL per-workflow link straight into its own filtered run history —
 * never a per-id link that promises a record which never opens (Opus round).
 * Older rows carry only bare ids (no name to link individually): those keep the
 * honest fallback — the ids as Mono text plus ONE generic link to the run history,
 * gated on the page the tenant can actually open.
 */
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { Mono } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { canAccessPage } from '@/lib/access'
import type { WebhookRequestWorkflowRef } from './webhookRequestTypes'

// Named workflows get a real deep link into their own filtered run history; unnamed legacy ids fall back to bare Mono text plus one generic run-history link (see file header).
export default function WorkflowRefs({ ids, workflows }: { ids: Array<string | number>; workflows?: WebhookRequestWorkflowRef[] }) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  // Gate on the page the link OPENS (the app's own render authority), not on a
  // neighbouring module page: a role with AI agents but without Details would
  // otherwise click into NoAccessPage (Opus B1, probed).
  const canOpenRuns = canAccessPage('details.runs', auth ?? undefined)

  // Named workflows (WEBHOOK-RUN-CORRELATION-1): one link per workflow, pre-filtered
  // on that workflow's own runs via the hash query param RunsTable reads.
  if (workflows && workflows.length > 0) {
    return (
      <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {workflows.map(w => {
          // A hard-erased workflow leaves name null (Opus round 2): render the
          // honest #id — never a nameless, empty-looking link.
          const name = w.name?.trim()
          if (!name) return <Mono key={String(w.id)} style={{ fontSize: 11.5 }}>#{w.id}</Mono>
          return canOpenRuns ? (
            <Button key={String(w.id)} variant="ghost" size="sm"
              href={`#details.runs?workflow_id=${encodeURIComponent(String(w.id))}`}
              title={t('webhooks.incoming.requests.openWorkflowRuns', { name })}>
              {name}
            </Button>
          ) : (
            <Mono key={String(w.id)} style={{ fontSize: 11.5 }}>{name}</Mono>
          )
        })}
      </span>
    )
  }

  // Honest fallback for older rows carrying only bare ids — no name to link
  // individually, so one generic link to the (unfiltered) run history.
  return (
    <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {ids.map(id => <Mono key={String(id)} style={{ fontSize: 11.5 }}>#{id}</Mono>)}
      {canOpenRuns && (
        <Button variant="ghost" size="sm" href="#details.runs" title={t('webhooks.incoming.requests.openHistory')}>
          {t('webhooks.incoming.requests.openHistory')}
        </Button>
      )}
    </span>
  )
}
