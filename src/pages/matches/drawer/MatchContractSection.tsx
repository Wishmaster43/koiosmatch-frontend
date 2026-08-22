/**
 * MatchContractSection — the editable match/contract layer, rendered as its
 * own drawer tab ("Contract & financieel", wired in MatchDrawer — split out from
 * OverviewTab's read-only summary per the §3A blueprint's real-tabs rule, 2026-07-14).
 * Grouped into CONTRACT + FINANCIEEL cards via the shared EditableFieldTable (§3A
 * in-place edit pattern: one pencil governs both cards), sourced from GET /matches/{id} (detail-only fields, §8)
 * and saved via useMatchContract's optimistic PATCH /matches/{id} (revert + toast
 * on 422/409).
 *
 * M29 (overzicht-layout cluster): `remarks` moved OUT of this shared-pencil
 * table onto the Overview tab as its own block with its own pencil
 * (MatchRemarksBlock) — editing it here too would be two truths for one
 * field (§11). This table no longer carries it.
 *
 * MATCH-EDIT-1 (Danny 22-08, "waar is het potlootje bij een match?"): contract_type,
 * start_date, end_date, hours_per_week, cost_center and billing_emails moved to
 * OverviewTab's own Contract/Financieel card (that card renders the moment the
 * drawer opens, so it is now the one place to edit them, §3A "no field in two
 * places") — this tab keeps only what Overview does NOT also show. The email
 * parsing/number-coercion helpers moved to the shared matchContractFieldUtils
 * so both callers use the one mapping, never two copies (§11).
 */
import { useTranslation } from 'react-i18next'
import { Unplug } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import { Caption, Mono } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { notifySuccess, notifyError } from '@/lib/notify'
import { useCao } from '@/lib/useCao'
import { useAuth } from '@/context/AuthContext'
import ContractFormChip from '../ContractFormChip'
import { useMatchContract } from '../hooks/useMatchContract'
import type { MatchContract } from '../hooks/useMatchContract'
import { numOrNull } from './matchContractFieldUtils'
import type { MatchRow } from '@/types/match'

interface Props {
  matchId: MatchRow['id'] | undefined
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  // Archived matches are read-only everywhere in this drawer (pickers, terminate,
  // renewal) — this tab's pencil follows the same rule (MATCH-EDIT-1 Opus round).
  archived?: boolean
}

export default function MatchContractSection({ matchId, onUpdate, archived }: Props) {
  const { t } = useTranslation(['matches', 'common'])
  const { types: caoTypes } = useCao()
  const { data, loading, error, unavailable, revertTick, retry, save } = useMatchContract(matchId, onUpdate)

  // MATCH-FIN-GATE-1 (Danny 14-08: "de marge op een plaatsing, autorisatie"):
  // what the agency PAYS (purchase_rate) and the derived margin are gated behind
  // the existing `matches.financial.view` permission — mirrors BankAccountCard's
  // FINANCIAL-GATE-1 precedent (hidden, not disabled, §7 is UX-only anyway). The
  // sell rate (what the customer pays) stays visible to every recruiter — it is
  // ordinary commercial data, not the agency's cost/margin.
  const auth = useAuth()
  const canSeeFinancial = !!auth?.hasPermission?.('matches.financial.view')

  // Editable schema — two titled cards (Contract / Financieel) in one table.
  // MATCH-EDIT-1: contract_type/start_date/end_date/hours_per_week (Contract) and
  // cost_center/billing_emails (Financieel) moved to OverviewTab — only what
  // Overview does not also show stays here.
  const fields: FieldRow[] = [
    { key: 'function_title', label: t('drawer.contract.functionTitle'), group: t('drawer.contract.groupContract') },
    { key: 'cao', label: t('drawer.contract.cao'), type: 'select',
      options: caoTypes.map(c => ({ value: c.value, label: c.label })), group: t('drawer.contract.groupContract') },

    { key: 'scale', label: t('drawer.contract.scale'), group: t('drawer.contract.groupFinancial') },
    { key: 'step', label: t('drawer.contract.step'), group: t('drawer.contract.groupFinancial') },
    { key: 'surcharge', label: t('drawer.contract.surcharge'), inputType: 'number', mono: true, group: t('drawer.contract.groupFinancial') },
    // MATCH-FIN-GATE-1: purchase rate omitted from the schema entirely without
    // the permission — hidden, never a disabled row still printing the number.
    ...(canSeeFinancial
      ? [{ key: 'purchase_rate', label: t('drawer.contract.purchaseRate'), inputType: 'number', mono: true, group: t('drawer.contract.groupFinancial') } as FieldRow]
      : []),
    { key: 'sell_rate', label: t('drawer.contract.sellRate'), inputType: 'number', mono: true, group: t('drawer.contract.groupFinancial') },
  ]

  // Current values, mapped to the schema's UI keys.
  const values: Record<string, unknown> = {
    function_title: data.function_title ?? '',
    cao: data.cao ?? '',
    scale: data.scale ?? '',
    step: data.step ?? '',
    surcharge: data.surcharge ?? '',
    purchase_rate: data.purchase_rate ?? '',
    sell_rate: data.sell_rate ?? '',
  }

  // Map the UI draft back to the PATCH body, then persist through the hook
  // (optimistic; the hook reverts on failure — we just surface the message).
  const handleSave = async (v: Record<string, unknown>) => {
    const patch: Partial<MatchContract> = {
      function_title: (v.function_title as string) || null,
      cao:            (v.cao as string) || null,
      scale:          (v.scale as string) || null,
      step:           (v.step as string) || null,
      surcharge:      numOrNull(v.surcharge),
      // MATCH-FIN-GATE-1: the field is omitted from the schema without the
      // permission, so `v.purchase_rate` is always undefined there — leave the
      // key OUT of the patch entirely (the backend rule is `sometimes`, i.e.
      // "unset means unchanged") rather than send `null` and silently wipe it.
      ...(canSeeFinancial ? { purchase_rate: numOrNull(v.purchase_rate) } : {}),
      sell_rate:      numOrNull(v.sell_rate),
    }
    try {
      await save(patch)
      notifySuccess(t('drawer.contract.saved'))
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notifyError(msg || t('drawer.contract.saveError'))
    }
  }

  // Four UI states (§3): loading / unavailable / error (+ retry) / success. "Empty"
  // (no contract data yet) is represented per-field as a dash, same as the sibling
  // candidate EditableFieldTable tabs (Preferences/ZZP) — not a separate screen.
  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 2px' }}>{t('drawer.contract.loading')}</div>
  }
  // A 503 means the backing integration isn't configured yet — a calm, neutral
  // notice, never the danger-coloured hard-error banner (C-15).
  if (unavailable) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)', padding: '10px 2px' }}>
        <Unplug size={14} />
        <span>{t('drawer.contract.unavailable')}</span>
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-danger-text)', padding: '10px 2px' }}>
        <span>{t('drawer.contract.error')}</span>
        <Button variant="secondary" size="sm" onClick={retry}>{t('common:error.retry')}</Button>
      </div>
    )
  }

  // Margin = sell − purchase, always derived and read-only (never entered directly).
  const hasRates = data.purchase_rate != null && data.sell_rate != null
  const margin = hasRates ? (data.sell_rate as number) - (data.purchase_rate as number) : data.margin

  return (
    <div>
      {/* MATCHES 13 (21-08): no inner heading — the drawer TAB already carries
          drawer.contract.title; repeating it here was the "kopje dubbel". */}
      {/* MATCH-SOORT-1: Contractvorm chip + its CONTRACTREGELS read-list — edited
          only via MatchModal (the popup owns the write path); this section only
          displays what was set there, mirroring the changelog's split (§2). */}
      {data.contractForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Caption as="span">{t('drawer.contract.contractForm')}</Caption>
            <ContractFormChip contractForm={data.contractForm} />
          </div>
          {data.contractLines.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {data.contractLines.map((l, i) => (
                <li key={l.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12,
                  padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <span style={{ color: 'var(--text)' }}>{l.functionTitle || '—'}</span>
                  <Mono style={{ color: 'var(--text-muted)' }}>
                    {l.rate != null ? l.rate.toFixed(2) : '—'}
                  </Mono>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* Remount only on a failed save (revertTick) or a match switch, so the
          uncontrolled table re-seeds its draft from the reverted/fresh data. */}
      {/* Canon (05-08): clean cards — no row dividers, 11px labels (candidate = leading);
          label width now the EditableFieldTable default (fieldRowCanon). */}
      <EditableFieldTable key={`${matchId}-${revertTick}`} fields={fields} value={values}
        onSave={archived ? undefined : handleSave} />
      {/* Derived margin — read-only, sits right under the rate fields. MATCH-FIN-GATE-1:
          hidden without the permission, same as the purchase rate row above — the
          margin is reconstructible from purchase+sell, so both must go together. */}
      {canSeeFinancial && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '7px 11px', borderRadius: 8, marginTop: 8,
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: margin != null ? (margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('drawer.contract.margin')}</span>
          <Mono style={{ fontWeight: 700 }}>{margin != null ? margin.toFixed(2) : '—'}</Mono>
        </div>
      )}
    </div>
  )
}
