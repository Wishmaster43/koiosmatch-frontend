/**
 * TenantTierAssignment (PRIJSMODEL-C DEEL C, task E2) — superadmin picks a
 * tenant and assigns an AI/workflow tier override (or falls back to the
 * package default) effective from a date. Props-only presenter (mirrors
 * TierCatalogTable/TierPlatformTogglesCard — no outer card/heading, the
 * parent supplies both); the parent container owns the PUT via `onAssign`
 * and the `assignments` list (this admin contract has no list route, so the
 * parent accumulates rows as tenants get assigned — `tenant_name` is
 * therefore optional and falls back to the id).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import SearchSelect from '@/components/ui/SearchSelect'
import DataTable from '@/components/ui/DataTable'
import { DateField } from '@/components/forms/fields'
import { GroupLabel } from '@/components/ui/typography'
import { useTenantSearch } from '@/hooks/useTenantSearch'
import { useDateFormat } from '@/lib/datetime'
import { toLocalIsoDate } from '@/lib/localDate'
import { label as labelStyle } from '../billingCardStyles'
import type { TierAssignmentRow } from './BillingTiersCard'
import type { AdminTenantBillingTiersUpdate, BillingAiTier, BillingTierRef, BillingWorkflowTier } from '@/types/billingTiers'

interface Props {
  aiTiers: BillingAiTier[]
  workflowTiers: BillingWorkflowTier[]
  onAssign: (tenantId: string, body: AdminTenantBillingTiersUpdate) => Promise<void>
  assignments: TierAssignmentRow[]
}

// Renders a tier ref's label — "fromPackage" phrasing when it came from the
// package baseline rather than a tenant's own choice.
function tierCell(ref: BillingTierRef | null | undefined, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (!ref) return '—'
  const label = ref.label || ref.key
  return ref.source === 'baseline' ? t('billingTiers.fromPackage', { tier: label }) : label
}

// Tenant picker + AI/workflow tier assignment form, with the current assignments table below.
export default function TenantTierAssignment({ aiTiers, workflowTiers, onAssign, assignments }: Props) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()
  const { options: tenantOptions, onSearch: onSearchTenants } = useTenantSearch()

  const [tenantId, setTenantId] = useState<string | null>(null)
  const [aiTierKey, setAiTierKey] = useState<string | null>(null)
  const [workflowTierKey, setWorkflowTierKey] = useState<string | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState<string>(toLocalIsoDate(new Date()))
  const [saving, setSaving] = useState(false)

  const tenantName = tenantOptions.find((o) => o.value === tenantId)?.label ?? tenantId ?? ''
  const aiOptions = [
    { value: '', label: t('billingTiers.tenantPackageDefault') },
    ...aiTiers.filter((tier) => tier.active).map((tier) => ({ value: tier.key, label: tier.label || tier.key })),
  ]
  const workflowOptions = [
    { value: '', label: t('billingTiers.tenantPackageDefault') },
    ...workflowTiers.filter((tier) => tier.active).map((tier) => ({ value: tier.key, label: tier.label || tier.key })),
  ]

  // Persist the current picker state as one tenant tier assignment.
  const save = async () => {
    if (!tenantId) return
    setSaving(true)
    try {
      await onAssign(tenantId, {
        ai_tier: aiTierKey ?? null,
        workflow_tier: workflowTierKey ?? null,
        effective_from: effectiveFrom,
      })
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    { key: 'tenant', header: t('billingTiers.colTenant'), render: (row: TierAssignmentRow) => row.tenant_name || row.tenant_id },
    { key: 'ai', header: t('billingTiers.colAiTier'), render: (row: TierAssignmentRow) => tierCell(row.ai, t) },
    { key: 'workflow', header: t('billingTiers.colWorkflowTier'), render: (row: TierAssignmentRow) => tierCell(row.workflow, t) },
    {
      key: 'since',
      header: t('billingTiers.colSince'),
      render: (row: TierAssignmentRow) => {
        const since = row.ai?.effective_from ?? row.workflow?.effective_from
        return since ? formatDate(since) : '—'
      },
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: '1 1 220px', minWidth: 200, maxWidth: 320 }}>
          <label style={labelStyle} id="tier-assign-tenant-label">{t('billingTiers.tenantPickerLabel')}</label>
          <SearchSelect
            triggerLabel={tenantName || t('billingTiers.tenantPickerPlaceholder')}
            options={tenantOptions}
            selected={tenantId ? [tenantId] : []}
            onToggle={(value) => setTenantId(value)}
            onSearch={onSearchTenants}
            closeOnToggle selectAll={false}
            triggerAriaLabel={t('billingTiers.tenantPickerLabel')}
          />
        </div>

        {tenantId && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 180 }}>
              <label style={labelStyle} id="tier-assign-ai-label">{t('billingTiers.tenantAiTier')}</label>
              <SearchSelect
                triggerLabel={aiOptions.find((o) => o.value === (aiTierKey ?? ''))?.label ?? t('billingTiers.tenantPackageDefault')}
                options={aiOptions}
                selected={[aiTierKey ?? '']}
                onToggle={(value) => setAiTierKey(value === '' ? null : value)}
                closeOnToggle selectAll={false}
                triggerAriaLabel={t('billingTiers.tenantAiTier')}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 180 }}>
              <label style={labelStyle} id="tier-assign-wf-label">{t('billingTiers.tenantWorkflowTier')}</label>
              <SearchSelect
                triggerLabel={workflowOptions.find((o) => o.value === (workflowTierKey ?? ''))?.label ?? t('billingTiers.tenantPackageDefault')}
                options={workflowOptions}
                selected={[workflowTierKey ?? '']}
                onToggle={(value) => setWorkflowTierKey(value === '' ? null : value)}
                closeOnToggle selectAll={false}
                triggerAriaLabel={t('billingTiers.tenantWorkflowTier')}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <label style={labelStyle} htmlFor="tier-assign-from">{t('billingTiers.tenantEffectiveFrom')}</label>
              <DateField id="tier-assign-from" value={effectiveFrom} onChange={setEffectiveFrom} />
            </div>
            <Button variant="primary" size="sm" onClick={save} disabled={saving}>
              {t('common.save')}
            </Button>
          </div>
        )}
      </div>

      <GroupLabel style={{ marginBottom: 10 }}>{t('billingTiers.assignmentsHeading')}</GroupLabel>
      <DataTable
        columns={columns}
        rows={assignments}
        getRowId={(row: TierAssignmentRow) => row.tenant_id}
        emptyText={t('billingTiers.assignmentsEmpty')}
      />
    </div>
  )
}
