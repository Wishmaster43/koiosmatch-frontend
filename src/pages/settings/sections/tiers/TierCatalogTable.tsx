/**
 * TierCatalogTable (PRIJSMODEL-C, DEEL C §4c) — one meter's platform tier
 * catalog (AI or workflow), fixed keys, no add/remove: label/monthly volume/
 * price/active are editable per row, `in_use` is read-only context. Props-only
 * presenter, mirrors BillingBudgetsCard's edit-in-place inputs but through the
 * shared DataTable (§4 HUISSTIJL-1) instead of hand-rolled cards.
 */
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import Toggle from '@/components/ui/Toggle'
import { Caption } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'
import type { BillingAiTier, BillingWorkflowTier } from '@/types/billingTiers'
import { inputWrap, inputStyle } from '../billingCardStyles'

// Patch shape a row edit sends up — only the fields this table can change.
export type TierRowPatch = Partial<{ label: string; monthly: number; price_cents: number; active: boolean }>

interface TierCatalogTableProps {
  meter: 'ai' | 'workflow'
  rows: Array<BillingAiTier | BillingWorkflowTier>
  onChange: (key: string, patch: TierRowPatch) => void
  disabled?: boolean
}

// The one editable field name differs per meter (weighted tokens vs runs), so
// the table reads/writes it generically as "monthly" and maps it here.
const monthlyOf = (row: BillingAiTier | BillingWorkflowTier): number => {
  const r = row as BillingAiTier & BillingWorkflowTier
  return r.monthly_tokens ?? r.monthly_runs ?? 0
}

// Renders the fixed-key platform tier catalog for one meter as an editable DataTable.
export default function TierCatalogTable({ meter, rows, onChange, disabled }: TierCatalogTableProps) {
  const { t } = useTranslation('settings')
  const { formatCurrency } = useNumberFormat()

  const columns = [
    {
      key: 'label',
      header: t('billingTiers.colLabel'),
      render: (row: BillingAiTier | BillingWorkflowTier) => (
        <div style={inputWrap}>
          <input
            aria-label={t('billingTiers.colLabel')}
            value={row.label ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(row.key, { label: e.target.value })}
            style={inputStyle}
          />
        </div>
      ),
    },
    {
      key: 'monthly',
      header: meter === 'ai' ? t('billingTiers.colIncludedTokens') : t('billingTiers.colIncludedRuns'),
      render: (row: BillingAiTier | BillingWorkflowTier) => (
        <div style={inputWrap}>
          <input
            type="number" min={0} step={1}
            aria-label={meter === 'ai' ? t('billingTiers.colIncludedTokens') : t('billingTiers.colIncludedRuns')}
            value={monthlyOf(row)}
            disabled={disabled}
            onChange={(e) => onChange(row.key, { monthly: Number(e.target.value) || 0 })}
            style={inputStyle}
          />
        </div>
      ),
    },
    {
      key: 'price_cents',
      header: t('billingTiers.colPrice'),
      render: (row: BillingAiTier | BillingWorkflowTier) => (
        <div>
          <div style={inputWrap}>
            <input
              type="number" min={0} step={1}
              aria-label={t('billingTiers.colPrice')}
              value={row.price_cents ?? 0}
              disabled={disabled}
              onChange={(e) => onChange(row.key, { price_cents: Number(e.target.value) || 0 })}
              style={inputStyle}
            />
          </div>
          <Caption>{t('billingTiers.priceCaption', { amount: formatCurrency((row.price_cents ?? 0) / 100) })}</Caption>
        </div>
      ),
    },
    {
      key: 'active',
      header: t('billingTiers.colActive'),
      align: 'center' as const,
      // F7: the toggle's aria-label names the row's own tier, not just "Active" —
      // several rows share the same generic label otherwise.
      render: (row: BillingAiTier | BillingWorkflowTier) => (
        <Toggle
          checked={row.active ?? false}
          disabled={disabled}
          ariaLabel={`${t('billingTiers.colActive')}: ${row.label || row.key}`}
          onChange={(v) => onChange(row.key, { active: v })}
        />
      ),
    },
    {
      key: 'in_use',
      header: t('billingTiers.colInUse'),
      // Read-only context, plain text — never a decorative dot (SCHERMWAARHEID-1 canon).
      render: (row: BillingAiTier | BillingWorkflowTier) =>
        t('billingTiers.inUseValue', { count: row.in_use ?? 0 }),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.key}
      emptyText={t('billingTiers.catalogEmpty')}
    />
  )
}
