/**
 * TenantBudgetOverride (CREDITS-2-FE deel 2) — the per-tenant exception row on
 * BillingBudgetsCard: a searchable tenant picker (GET /tenants?search=, the
 * TenantSwitcher's own contract) + three editable budget fields. An empty field
 * clears that one override back to the package default (never a whole-entry
 * wipe) — the parent card owns the actual PUT.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SearchSelect from '@/components/ui/SearchSelect'
import { Caption, GroupLabel, monoStyle } from '@/components/ui/typography'
import { useTenantSearch } from '@/hooks/useTenantSearch'
import type { BillingBudgetEntry } from '@/types/billingUsage'

// ai_token_budget dropped (PRIJSMODEL-C): AI capacity is a staffel now, not a
// raw-token budget knob here. workflow_credit_budget renamed to included_workflow_runs.
// whatsapp_token_budget RETIRED (K-242, 02-09): WhatsApp usage folds into the
// workflow-run bundle now — a PUT still sending it 422s.
interface Draft { included_workflow_runs: string }

const label = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }
// Color lives on the WRAP, not the input — mirrors BillingBudgetsCard's split.
const inputWrap = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', background: 'var(--input-bg)', color: 'var(--text)' }
const inputStyle = { border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%', ...monoStyle }

const draftFromEntry = (entry?: BillingBudgetEntry): Draft => ({
  included_workflow_runs: entry?.included_workflow_runs != null ? String(entry.included_workflow_runs) : '',
})

interface Props {
  tenants: Record<string, BillingBudgetEntry>
  tenantId: string | null
  onTenantIdChange: (id: string | null) => void
  draft: Draft
  onDraftChange: (draft: Draft) => void
}

// Super-admin per-tenant budget override: search-picks a tenant, then edits its workflow-token budget draft (K-242: one unit).
export default function TenantBudgetOverride({ tenants, tenantId, onTenantIdChange, draft, onDraftChange }: Props) {
  const { t } = useTranslation('settings')
  const { options, onSearch } = useTenantSearch()
  const [pickedLabel, setPickedLabel] = useState('')

  // Picking a tenant seeds the field from its existing override, if any.
  const pickTenant = (id: string) => {
    const found = options.find((o) => o.value === id)
    onTenantIdChange(id)
    setPickedLabel(found?.label ?? id)
    onDraftChange(draftFromEntry(tenants[id]))
  }

  return (
    <div>
      <GroupLabel style={{ marginBottom: 10 }}>{t('billingBudgets.tenantHeading')}</GroupLabel>
      <div style={{ marginBottom: 12, maxWidth: 320 }}>
        <label style={label}>{t('billingBudgets.tenantPickerLabel')}</label>
        <SearchSelect
          options={options}
          selected={tenantId ? [tenantId] : []}
          onToggle={pickTenant}
          onSearch={onSearch}
          closeOnToggle
          triggerLabel={tenantId ? pickedLabel : t('billingBudgets.tenantPickerPlaceholder')}
        />
      </div>

      {tenantId && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 4 }}>
          <div style={{ flex: '1 1 160px', minWidth: 140 }}>
            <label style={label} htmlFor="tenant-budget-wf">{t('billingBudgets.workflowBudgetLabel')}</label>
            <div style={inputWrap}>
              <input id="tenant-budget-wf" type="number" min={0} step={1}
                value={draft.included_workflow_runs}
                onChange={(e) => onDraftChange({ ...draft, included_workflow_runs: e.target.value })}
                placeholder={t('billingBudgets.tenantClearPlaceholder')}
                style={inputStyle} />
            </div>
          </div>
          <Caption style={{ paddingBottom: 8 }}>{t('billingBudgets.tenantClearHint')}</Caption>
        </div>
      )}
    </div>
  )
}
