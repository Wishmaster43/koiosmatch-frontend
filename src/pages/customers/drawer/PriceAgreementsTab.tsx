/**
 * PriceAgreementsTab — the customer's price agreements (MATCH-PLC, 2026-07-09):
 * the purchase/sale rates a placement should use for a given function/CAO/schaal/
 * trede combination (each optional = wildcard). Add via an inline form (soft
 * primary-tinted panel, mirrors DocumentsTab's pending-upload panel); each row is
 * a PriceAgreementRow with in-place edit + delete. Handles all four UI states.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw, AlertTriangle } from 'lucide-react'
import { usePriceAgreements } from '../hooks/usePriceAgreements'
import PriceAgreementForm, { emptyDraft, draftToPayload } from './PriceAgreementForm'
import type { PriceAgreementDraft } from './PriceAgreementForm'
import PriceAgreementRow from './PriceAgreementRow'
import type { Id } from '@/types/common'

export default function PriceAgreementsTab({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation('customers')
  const { agreements, loading, error, reload, add, update, remove } = usePriceAgreements(customerId)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<PriceAgreementDraft>(emptyDraft)

  // Submit the add-form, then close it and reset for the next entry.
  const saveNew = () => { add(draftToPayload(draft)); setAdding(false); setDraft(emptyDraft()) }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          {t('drawer.tabs.priceAgreements')} <span style={{ fontWeight: 400 }}>{agreements.length}</span>
        </span>
        {!adding && (
          <button onClick={() => { setDraft(emptyDraft()); setAdding(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Plus size={11} /> {t('priceAgreements.add')}
          </button>
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
