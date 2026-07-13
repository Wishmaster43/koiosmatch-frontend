/**
 * MatchContractSection — the editable placement/contract layer, rendered beneath
 * the read-only match summary (OverviewTab). Grouped into CONTRACT + FINANCIEEL
 * cards via the shared EditableFieldTable (§3A in-place edit pattern: one pencil
 * governs both cards), sourced from GET /matches/{id} (detail-only fields, §8)
 * and saved via useMatchContract's optimistic PATCH /matches/{id} (revert + toast
 * on 422/409). Billing emails have no dedicated tenant lookup, so they're edited
 * as one line/comma-separated text field and mapped back to the array the
 * backend expects (the placement-form multi-input list was judged out of scope
 * for the shared table component — see the Self-Audit note).
 */
import { useTranslation } from 'react-i18next'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { notifySuccess, notifyError } from '@/lib/notify'
import { useContractTypes } from '@/lib/useContractTypes'
import { useCao } from '@/lib/useCao'
import { useMatchContract } from '../hooks/useMatchContract'
import type { MatchContract } from '../hooks/useMatchContract'
import type { MatchRow } from '@/types/match'

// Split the textarea's free text back into a trimmed, de-duplicated email array.
function parseEmails(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map(s => s.trim()).filter(Boolean))]
}

// Coerce an empty/undefined UI value to null; else Number(...) for the API.
function numOrNull(v: unknown): number | null {
  return v === '' || v == null ? null : Number(v)
}

interface Props {
  matchId: MatchRow['id'] | undefined
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
}

export default function MatchContractSection({ matchId, onUpdate }: Props) {
  const { t } = useTranslation(['matches', 'common'])
  const { types: contractTypes } = useContractTypes()
  const { types: caoTypes } = useCao()
  const { data, loading, error, revertTick, retry, save } = useMatchContract(matchId, onUpdate)

  // Editable schema — two titled cards (Contract / Financieel) in one table.
  const fields: FieldRow[] = [
    { key: 'contract_type', label: t('drawer.contract.contractType'), type: 'select',
      options: contractTypes.map(c => ({ value: c, label: c })), group: t('drawer.contract.groupContract') },
    { key: 'cao', label: t('drawer.contract.cao'), type: 'select',
      options: caoTypes.map(c => ({ value: c.value, label: c.label })), group: t('drawer.contract.groupContract') },
    { key: 'start_date', label: t('drawer.contract.startDate'), type: 'date', group: t('drawer.contract.groupContract') },
    { key: 'end_date', label: t('drawer.contract.endDate'), type: 'date', group: t('drawer.contract.groupContract') },
    { key: 'hours_per_week', label: t('drawer.contract.hoursPerWeek'), inputType: 'number', group: t('drawer.contract.groupContract') },

    { key: 'scale', label: t('drawer.contract.scale'), group: t('drawer.contract.groupFinancial') },
    { key: 'step', label: t('drawer.contract.step'), group: t('drawer.contract.groupFinancial') },
    { key: 'purchase_rate', label: t('drawer.contract.purchaseRate'), inputType: 'number', mono: true, group: t('drawer.contract.groupFinancial') },
    { key: 'sell_rate', label: t('drawer.contract.sellRate'), inputType: 'number', mono: true, group: t('drawer.contract.groupFinancial') },
    { key: 'cost_center', label: t('drawer.contract.costCenter'), group: t('drawer.contract.groupFinancial') },
    { key: 'billing_emails_text', label: t('drawer.contract.billingEmails'), type: 'textarea', group: t('drawer.contract.groupFinancial') },
    { key: 'remarks', label: t('drawer.contract.remarks'), type: 'textarea', group: t('drawer.contract.groupFinancial') },
  ]

  // Current values, mapped to the schema's UI keys (billing_emails → newline text).
  const values: Record<string, unknown> = {
    contract_type: data.contract_type ?? '',
    cao: data.cao ?? '',
    start_date: data.start_date ?? '',
    end_date: data.end_date ?? '',
    hours_per_week: data.hours_per_week ?? '',
    scale: data.scale ?? '',
    step: data.step ?? '',
    purchase_rate: data.purchase_rate ?? '',
    sell_rate: data.sell_rate ?? '',
    cost_center: data.cost_center ?? '',
    billing_emails_text: data.billing_emails.join('\n'),
    remarks: data.remarks ?? '',
  }

  // Map the UI draft back to the PATCH body, then persist through the hook
  // (optimistic; the hook reverts on failure — we just surface the message).
  const handleSave = async (v: Record<string, unknown>) => {
    const patch: Partial<MatchContract> = {
      contract_type:  (v.contract_type as string) || null,
      cao:            (v.cao as string) || null,
      start_date:     (v.start_date as string) || null,
      end_date:       (v.end_date as string) || null,
      hours_per_week: numOrNull(v.hours_per_week),
      scale:          (v.scale as string) || null,
      step:           (v.step as string) || null,
      purchase_rate:  numOrNull(v.purchase_rate),
      sell_rate:      numOrNull(v.sell_rate),
      cost_center:    (v.cost_center as string) || null,
      billing_emails: parseEmails(String(v.billing_emails_text ?? '')),
      remarks:        (v.remarks as string) || null,
    }
    try {
      await save(patch)
      notifySuccess(t('drawer.contract.saved'))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notifyError(msg || t('drawer.contract.saveError'))
    }
  }

  // Four UI states (§3): loading / error (+ retry) / success. "Empty" (no contract
  // data yet) is represented per-field as a dash, same as the sibling candidate
  // EditableFieldTable tabs (Preferences/ZZP) — not a separate placeholder screen.
  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 2px' }}>{t('drawer.contract.loading')}</div>
  }
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger)', padding: '10px 2px' }}>
        <span>{t('drawer.contract.error')}</span>
        <button onClick={retry} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
          padding: '3px 9px', cursor: 'pointer', color: 'var(--text)' }}>{t('common:error.retry')}</button>
      </div>
    )
  }

  // Margin = sell − purchase, always derived and read-only (never entered directly).
  const hasRates = data.purchase_rate != null && data.sell_rate != null
  const margin = hasRates ? (data.sell_rate as number) - (data.purchase_rate as number) : data.margin

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t('drawer.contract.title')}</div>
      {/* Remount only on a failed save (revertTick) or a match switch, so the
          uncontrolled table re-seeds its draft from the reverted/fresh data. */}
      <EditableFieldTable key={`${matchId}-${revertTick}`} fields={fields} value={values} onSave={handleSave} labelWidth={150} />
      {/* Derived margin — read-only, sits right under the rate fields. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '7px 11px', borderRadius: 8, marginTop: -4,
        background: 'var(--surface)', border: '1px solid var(--border)',
        color: margin != null ? (margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
        <span style={{ color: 'var(--text-muted)' }}>{t('drawer.contract.margin')}</span>
        <span style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{margin != null ? margin.toFixed(2) : '—'}</span>
      </div>
    </div>
  )
}
