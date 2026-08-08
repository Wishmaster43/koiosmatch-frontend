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
import { Field, TextField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

interface OptionRow { value: string; label: string }

// VALIDATIE-LIVE-1-rest: the live-format message under billingEmail — same
// small local component ContactDetailsCard/ContactCard already use for this
// exact purpose (no shared component exists for a one-line field error yet).
function FieldError({ text }: { text?: string }) {
  if (!text) return null
  return <div role="alert" style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 3 }}>{text}</div>
}

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
          <Field label={t('modal.fields.accountManager')}>
            <CreatableSelect value={form.ownerId || null} onChange={v => set('ownerId', v)} allowCreate={false}
              placeholder={t('modal.fields.selectOwner')} options={userOptions} />
          </Field>
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
          <Field label={t('overview.website')}>
            <TextField value={form.website} onChange={v => set('website', v)} placeholder="https://" />
          </Field>
        </div>
      </div>

      {/* Reuses the drawer OverviewTab's own "Facturatie" card heading. */}
      <div>
        <div style={cardHead}>{t('overview.billing')}</div>
        <div style={cardBox}>
          <div style={row2}>
            <Field label={t('overview.costCenter')}>
              <TextField value={form.costCenter} onChange={v => set('costCenter', v)} />
            </Field>
            <div onBlur={onBillingEmailBlur}>
              <Field label={t('overview.billingEmail')}>
                <TextField type="email" value={form.billingEmail} onChange={v => set('billingEmail', v)} error={billingEmailError} />
              </Field>
              <FieldError text={billingEmailMessage} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
