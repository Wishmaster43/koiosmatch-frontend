import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { Mono } from '@/components/ui/typography'
import { useAuth } from '@/context/AuthContext'
import { canAccessPage } from '@/lib/access'

/**
 * WorkflowRefs — the workflow ids an inbound webhook request dispatched to,
 * rendered HONESTLY (WEBHOOK-LOG-FE-1, Opus round): the run starts async, so the
 * receipt carries no run id, and the runs page cannot filter by workflow id yet
 * (WEBHOOK-RUN-CORRELATION-1). So: the ids as Mono text plus ONE link to the run
 * history, gated on the page the tenant can actually open — never a per-id
 * '?open=<workflow_id>' link that promises a record which never opens.
 */
export default function WorkflowRefs({ ids }: { ids: Array<string | number> }) {
  const { t } = useTranslation('settings')
  const auth = useAuth()
  // Gate on the page the link OPENS (the app's own render authority), not on a
  // neighbouring module page: a role with AI agents but without Details would
  // otherwise click into NoAccessPage (Opus B1, probed).
  const canOpenRuns = canAccessPage('details.runs', auth ?? undefined)
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
