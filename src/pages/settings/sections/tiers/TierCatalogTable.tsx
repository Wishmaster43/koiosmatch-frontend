/**
 * TierCatalogTable (PRIJSMODEL-C, DEEL C §4c) — one meter's platform tier
 * catalog (AI or workflow), fixed keys, no add/remove: label/monthly volume/
 * price/active are editable per row, `in_use` is read-only context. Props-only
 * presenter on the shared DataTable with the settings-kit fields: the name is a
 * plain TextField, the volume a NumberField (thousands grouped), the price a
 * CurrencyInput in euros (the API keeps cents) — Danny 09-09: no mono names, no
 * cents, a separator in every thousand.
 */
import { useTranslation } from 'react-i18next'
import DataTable from '@/components/ui/DataTable'
import Toggle from '@/components/ui/Toggle'
import CurrencyInput from '@/components/ui/CurrencyInput'
import type { BillingAiTier, BillingWorkflowTier } from '@/types/billingTiers'
import { NumberField, TextField } from '@/pages/settings/components/SettingsKit'

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
  const volumeHeader = meter === 'ai' ? t('billingTiers.colIncludedTokens') : t('billingTiers.colIncludedRuns')

  const columns = [
    {
      key: 'label',
      header: t('billingTiers.colLabel'),
      render: (row: BillingAiTier | BillingWorkflowTier) => (
        <TextField value={row.label ?? ''} width={180} disabled={disabled}
          onChange={(v: string) => onChange(row.key, { label: v })} />
      ),
    },
    {
      key: 'monthly',
      header: volumeHeader,
      render: (row: BillingAiTier | BillingWorkflowTier) => (
        <NumberField value={monthlyOf(row)} min={0} width={110} disabled={disabled}
          ariaLabel={`${volumeHeader}: ${row.label || row.key}`}
          onChange={(v: number) => onChange(row.key, { monthly: v })} />
      ),
    },
    {
      key: 'price_cents',
      header: t('billingTiers.colPrice'),
      render: (row: BillingAiTier | BillingWorkflowTier) => (
        <CurrencyInput cents={row.price_cents ?? 0} width={110} disabled={disabled}
          unit={t('billingTiers.perMonth')}
          ariaLabel={`${t('billingTiers.colPrice')}: ${row.label || row.key}`}
          onChange={(cents) => onChange(row.key, { price_cents: cents ?? 0 })} />
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
