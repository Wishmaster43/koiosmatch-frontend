/**
 * UsagePerWorkflowTab (F5, "Per workflow") — workflow.per_workflow from
 * GET /billing/usage, one row per workflow with its Koios Tokens run count and
 * amount. A row click deep-links to that workflow's editor at
 * `#aiagents?open=<id>` (WF-EDITOR-DEEPLINK-1's own URL contract — a cell is a
 * gateway, never a dead end, §3A CEL-DOORKLIK-CANON).
 */
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@/context/NavigationContext'
import { useNumberFormat } from '@/lib/formatters'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { SectionTitle } from '@/components/ui/typography'
import { card, sub, notice } from '../usageCardStyles'
import type { BillingUsageWorkflow } from '@/types/billingUsage'

interface UsagePerWorkflowTabProps {
  workflow: BillingUsageWorkflow | undefined
  phase: 'loading' | 'ready' | 'empty' | 'error' | 'unavailable'
}

type Row = NonNullable<BillingUsageWorkflow['per_workflow']>[number]

// See the file's top doc above; each row deep-links to its workflow editor (CEL-DOORKLIK-CANON, a cell is a gateway, never a dead end).
export default function UsagePerWorkflowTab({ workflow, phase }: UsagePerWorkflowTabProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  // Row click opens the workflow editor through the app's navigation seam (a hash
  // assignment alone never reaches the shell's router).
  const { openEntity } = useNavigation()

  const columns: Column<Row>[] = [
    { key: 'name', header: t('billing.usage.perWorkflow.colName'), sortable: true, render: (r) => r.name ?? r.workflow_id },
    { key: 'runs', header: t('billing.usage.perWorkflow.colRuns'), align: 'right', sortable: true, render: (r) => formatNumber(r.runs) },
    { key: 'credits', header: t('billing.usage.perWorkflow.colTokens'), align: 'right', sortable: true, render: (r) => formatNumber(r.credits) },
    { key: 'amount', header: t('billing.usage.perWorkflow.colAmount'), align: 'right', sortable: true, render: (r) => formatCurrency((r.credits ?? 0) * (workflow?.credit_price ?? 0)) },
  ]

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.perWorkflow.title')}</SectionTitle>
      <div style={sub}>{t('billing.usage.perWorkflow.subtitle')}</div>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.perWorkflow.loadError')}</p>}
      {phase === 'unavailable' && <p style={notice}>{t('billing.usage.perWorkflow.unavailable')}</p>}
      {(phase === 'ready' || phase === 'empty') && (
        <DataTable columns={columns} rows={workflow?.per_workflow ?? []} getRowId={(r) => r.workflow_id}
          onRowClick={(r) => openEntity('aiagents', r.workflow_id)} emptyText={t('billing.usage.perWorkflow.empty')} />
      )}
    </div>
  )
}
