/**
 * CustomerBusinessCards — the RIGHT-column trio of small secondary cards in
 * AddCustomerModal: account manager (Eigenaar), website (Online) and
 * cost-center/billing-email (Facturatie). Bundled into one file rather than
 * three near-empty ones — each card is a single field or a short row, so a
 * one-card-per-file split would just fragment three trivial blocks. Extracted
 * (§0.3 — the ~400-line split trigger, 2026-08-03); pure presentational, every
 * value and callback comes from the parent's own form state.
 */
import { useTranslation } from 'react-i18next'
import type { CustomerForm } from '../AddCustomerModal'
import { FieldRow, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'
import FieldNotice from '@/components/ui/FieldNotice'

interface OptionRow { value: string; label: string }

// VALIDATIE-LIVE-1-rest: the live-format message under billingEmail. The local
// copy this file used to carry is gone — it now renders through the shared
// components/ui/FieldNotice (KVK/BTW-PER-LAND-1, 08-08), which owns the one
// look for a field message and adds the warning severity the per-country
// KvK/BTW check needs (§11: a new shared helper lands WITH adoption).

interface CustomerBusinessCardsProps {
  form: CustomerForm
  set: (k: keyof CustomerForm, v: string) => void
  userOptions: OptionRow[]
  // VALIDATIE-LIVE-1-rest: live format check for billingEmail — blur marks it
  // touched so the message can render; the message itself is resolved upstream.
  billingEmailError?: boolean
  billingEmailMessage?: string
  onBillingEmailBlur?: () => void
}

// The right-column trio of secondary cards (see file docblock above) — purely
// presentational, every value/callback comes from the parent's own form state.
export default function CustomerBusinessCards({
  form, set, userOptions, billingEmailError, billingEmailMessage, onBillingEmailBlur,
}: CustomerBusinessCardsProps) {
  const { t } = useTranslation(['customers', 'common'])
  return (
    <>
      {/* STATUS-HIDDEN-1 (Danny 02-08): deployability status is no longer picked
          here — the phase pills in the header already carry the lifecycle
          choice, and a new customer starts on the tenant's default status (see
          the container's defaultStatusValue), sent along unseen. Only the
          owner picker remains in this card. */}
      <div>
        <div style={cardHead}>{t('modal.fields.cardOwner')}</div>
        <div style={cardBox}>
          <FieldRow label={t('modal.fields.accountManager')}>
            {/* CLEAR-SWEEP (Danny 13-08): owner is genuinely optional (the create
                body sends owner_id unconditionally, including empty — see
                useCustomerRecord.handleCreate) — so clearable. */}
            <CreatableSelect value={form.ownerId || null} onChange={v => set('ownerId', v)} allowCreate={false}
              clearable clearLabel={t('modal.fields.accountManager')}
              placeholder={t('modal.fields.selectOwner')} options={userOptions} />
          </FieldRow>
        </div>
      </div>

      {/* Reuses the drawer OverviewTab's own "Online" card heading (one
          translation source for the same grouping). Website only now —
          Bedrijfstekst moved to its own collapsed-ghost card. KLANT-LAYOUT-2:
          un-paired from Facturatie (was a cardPair) — a second inner 2-column
          grid inside an already-halved column reads worse than plain stacking. */}
      <div>
        <div style={cardHead}>{t('overview.online')}</div>
        <div style={cardBox}>
          <FieldRow label={t('overview.website')}>
            <TextField value={form.website} onChange={v => set('website', v)} placeholder="https://" />
          </FieldRow>
        </div>
      </div>

      {/* Reuses the drawer OverviewTab's own "Facturatie" card heading. */}
      <div>
        <div style={cardHead}>{t('overview.billing')}</div>
        <div style={cardBox}>
          <div style={row2}>
            <FieldRow label={t('overview.costCenter')}>
              <TextField value={form.costCenter} onChange={v => set('costCenter', v)} />
            </FieldRow>
            <div onBlur={onBillingEmailBlur}>
              <FieldRow label={t('overview.billingEmail')}>
                <TextField type="email" value={form.billingEmail} onChange={v => set('billingEmail', v)} error={billingEmailError} />
              </FieldRow>
              <FieldNotice text={billingEmailMessage} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
