/**
 * PriceAgreementsTab — the customer's price agreements (MATCH-PLC, 2026-07-09):
 * the purchase/sale rates a placement should use for a given function/CAO/schaal/
 * trede combination (each optional = wildcard). Add via an inline form (soft
 * primary-tinted panel, mirrors DocumentsTab's pending-upload panel); each row is
 * a PriceAgreementRow with in-place edit + delete. Handles all four UI states.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, AlertTriangle } from 'lucide-react'
// House "+ action" trigger (Danny 27-07: "+ Prijsafspraak toevoegen moet ook
// knopje zijn!!! zoals in kandidaat drill down") — replaces the bare text button below.
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { usePriceAgreements } from '../hooks/usePriceAgreements'
import PriceAgreementForm, { emptyDraft, draftToPayload } from './PriceAgreementForm'
import type { PriceAgreementDraft } from './PriceAgreementForm'
import PriceAgreementRow from './PriceAgreementRow'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import { useLocations } from '@/lib/useLocations'
import type { Customer } from '@/types/customer'
import type { Id } from '@/types/common'

export default function PriceAgreementsTab({ customerId, c, onSave }: { customerId?: Id; c?: Customer; onSave?: (values: Record<string, unknown>) => void }) {
  const { t } = useTranslation('customers')
  const { agreements, loading, error, reload, add, update, remove } = usePriceAgreements(customerId)
  // Same establishment list the match form uses, so both offer exactly one source.
  const branchOptions = useLocations().map(l => ({ value: String(l.value), label: l.label }))
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<PriceAgreementDraft>(emptyDraft)

  // Submit the add-form, then close it and reset for the next entry.
  const saveNew = () => { add(draftToPayload(draft)); setAdding(false); setDraft(emptyDraft()) }

  return (
    <div>
      {/* Facturatie moved here off the company tab (Danny 28-07) — kostenplaats is the
          top of the afdeling>locatie>klant cascade the placement form reads, and the
          billing e-mail is the ONE address invoicing uses regardless of which location
          or department a match picks. Both are money, so they live on the money tab. */}
      {c && (
        <div style={{ marginBottom: 14 }}>
          <EditableFieldTable
            title={t('overview.billing')}
            fields={[
              // Which establishment this customer's paperwork/invoicing runs through
              // (BRANCH-1). It sits with the other billing settings rather than on the
              // company tab (Danny 28-07) — it decides where the invoice comes from.
              { key: 'branchId', label: t('overview.branchField'), type: 'select', options: branchOptions },
              { key: 'costCenter',   label: t('overview.costCenter') },
              { key: 'billingEmail', label: t('overview.billingEmail') },
            ]}
            value={c as unknown as Record<string, unknown>}
            onSave={onSave}
          />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          {t('drawer.tabs.priceAgreements')} <span style={{ fontWeight: 400 }}>{agreements.length}</span>
        </span>
        {!adding && (
          <DrawerAddButton onClick={() => { setDraft(emptyDraft()); setAdding(true) }} label={t('priceAgreements.add')} />
        )}
      </div>

      {adding && (
        <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-primary-bg)' }}>
          <PriceAgreementForm draft={draft} onChange={patch => setDraft(d => ({ ...d, ...patch }))}
            onSave={saveNew} onCancel={() => setAdding(false)} saveLabel={t('priceAgreements.add')} />
        </div>
      )}

      {/* Loading state. */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <RefreshCw size={13} className="animate-spin" /> {t('priceAgreements.loading')}
        </div>
      )}

      {/* Error state — never a silent blank screen. */}
      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, fontSize: 12, color: 'var(--color-danger)' }}>
          <AlertTriangle size={13} />
          <span>{t('priceAgreements.loadError')}</span>
          {/* Arrow-wrap: reload now takes an optional AbortSignal (audit r4) — the
              click event must never flow into that parameter. */}
          <button onClick={() => reload()} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('priceAgreements.retry')}</button>
        </div>
      )}

      {/* Empty state. */}
      {!loading && !error && agreements.length === 0 && !adding && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>{t('priceAgreements.empty')}</div>
      )}

      {/* Success state — the list. */}
      {!loading && !error && agreements.map(a => (
        <PriceAgreementRow key={String(a.id)} agreement={a} onSave={update} onDelete={remove} />
      ))}
    </div>
  )
}
