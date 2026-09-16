/**
 * PriceAgreementForm — the shared field-set for both "add" (PriceAgreementsTab) and
 * "edit" (PriceAgreementRow) — one place to keep the fields in sync. function_title
 * and cao are tenant lookups (useFunctions/useCao) with an explicit "any" option at
 * the top, since each of function_title/cao/scale/step is an optional wildcard match
 * criterion on the backend (§ MATCH-PLC price-agreements). Mirrors the contract/
 * financial field layout of MatchModal.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SelectMenu from '@/components/ui/SelectMenu'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { FieldRow, TextField } from '@/components/forms/fields'
import { useFunctions } from '@/lib/useFunctions'
import { useCao } from '@/lib/useCao'
import { useAuth } from '@/context/AuthContext'
import type { PriceAgreement, PriceAgreementPayload } from '../hooks/usePriceAgreements'
import Button from '@/components/ui/Button'

// The form's own string-based draft — every field is a controlled input value;
// numbers/dates convert to the payload shape only on submit (draftToPayload).
export interface PriceAgreementDraft {
  functionTitle: string
  cao: string
  scale: string
  step: string
  purchaseRate: string
  saleRate: string
  validFrom: string
  validUntil: string
  remarks: string
}

export const emptyDraft = (): PriceAgreementDraft => ({
  functionTitle: '', cao: '', scale: '', step: '',
  purchaseRate: '', saleRate: '', validFrom: '', validUntil: '', remarks: '',
})

// Seed a draft from a persisted agreement (edit mode).
export const draftFromAgreement = (a: PriceAgreement): PriceAgreementDraft => ({
  functionTitle: a.functionTitle ?? '',
  cao: a.cao ?? '',
  scale: a.scale ?? '',
  step: a.step ?? '',
  purchaseRate: a.purchaseRate != null ? String(a.purchaseRate) : '',
  saleRate: a.saleRate != null ? String(a.saleRate) : '',
  validFrom: a.validFrom ?? '',
  validUntil: a.validUntil ?? '',
  remarks: a.remarks ?? '',
})

// Blank wildcard fields → null; required fields (purchaseRate/validFrom) are
// guarded by isDraftValid before this ever runs.
export const draftToPayload = (d: PriceAgreementDraft): PriceAgreementPayload => ({
  functionTitle: d.functionTitle || null,
  cao: d.cao || null,
  scale: d.scale.trim() || null,
  step: d.step.trim() || null,
  purchaseRate: d.purchaseRate ? Number(d.purchaseRate) : null,
  saleRate: d.saleRate ? Number(d.saleRate) : null,
  validFrom: d.validFrom || null,
  validUntil: d.validUntil || null,
  remarks: d.remarks.trim() || null,
})

// MATCH-FIN-GATE-1: purchase rate is required on the backend for CREATE, but a
// user without `matches.financial.view` never sees the field at all — so the
// requirement is skipped for them (they simply cannot set it either way; the
// backend re-checks on write). `requirePurchaseRate` defaults true so every
// other caller/test keeps today's behaviour.
export const isDraftValid = (d: PriceAgreementDraft, requirePurchaseRate = true): boolean =>
  (!requirePurchaseRate || d.purchaseRate.trim() !== '') && d.validFrom.trim() !== ''

interface PriceAgreementFormProps {
  draft: PriceAgreementDraft
  onChange: (patch: Partial<PriceAgreementDraft>) => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  saving?: boolean
}

// Editable price-agreement form (function/CAO/rate fields), fully controlled by the caller's draft/onChange.
export default function PriceAgreementForm({ draft, onChange, onSave, onCancel, saveLabel, saving }: PriceAgreementFormProps) {
  const { t } = useTranslation('customers')
  const { functions } = useFunctions()
  const { types: caoTypes } = useCao()
  // MATCH-FIN-GATE-1 (Danny 14-08): the purchase rate — what the agency pays,
  // and the source of the margin — is gated on `matches.financial.view`
  // (the closest existing permission; see MatchContractSection for the same
  // gate). The sale rate below stays visible to every recruiter.
  const auth = useAuth()
  const canSeeFinancial = !!auth?.hasPermission?.('matches.financial.view')
  // K11d (13-08): the remarks editor can expand to a bigger window, same affordance
  // as every other rich-text block — Generate/pop-out are deliberately skipped here
  // per KD9, only the expand toggle ships.
  const [remarksExpanded, setRemarksExpanded] = useState(false)

  // "Any" sits first in both lookups — selecting it clears the wildcard field.
  const functionOptions = [{ value: '', label: t('priceAgreements.any') }, ...functions.map(f => ({ value: f, label: f }))]
  const caoOptions = [{ value: '', label: t('priceAgreements.any') }, ...caoTypes.map(c => ({ value: c.value, label: c.label }))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Single-column FieldRows: this form renders in a COMPACT panel (480px modal,
          20px padding → 440px content), where a row2 two-column grid leaves only
          ~84px for each control after the fixed 120px canon label — unusable for
          the date/number/select inputs below (measured against PlanIntakeModal's
          580px single-column precedent). */}
      <FieldRow label={t('priceAgreements.function')}>
        <SelectMenu value={draft.functionTitle} onChange={v => onChange({ functionTitle: v })} options={functionOptions} placeholder={t('priceAgreements.any')} />
      </FieldRow>
      <FieldRow label={t('priceAgreements.cao')}>
        <SelectMenu value={draft.cao} onChange={v => onChange({ cao: v })} options={caoOptions} placeholder={t('priceAgreements.any')} />
      </FieldRow>
      <FieldRow label={t('priceAgreements.scale')}>
        <TextField value={draft.scale} onChange={v => onChange({ scale: v })} placeholder={t('priceAgreements.any')} />
      </FieldRow>
      <FieldRow label={t('priceAgreements.step')}>
        <TextField value={draft.step} onChange={v => onChange({ step: v })} placeholder={t('priceAgreements.any')} />
      </FieldRow>
      {/* MATCH-FIN-GATE-1: purchase rate omitted entirely without the permission —
          hidden, not disabled. RATE-EENHEID-1: both rates are decimal(10,2) money
          (€/hour), so step=0.01 keeps the native spinner and validation honest. */}
      {canSeeFinancial && (
        <FieldRow label={t('priceAgreements.purchaseRate')}>
          <TextField type="number" min={0} step={0.01} value={draft.purchaseRate} onChange={v => onChange({ purchaseRate: v })} style={{ fontFamily: 'JetBrains Mono, monospace' }} placeholder={t('priceAgreements.purchaseRateExample')} />
        </FieldRow>
      )}
      <FieldRow label={t('priceAgreements.saleRate')}>
        <TextField type="number" min={0} step={0.01} value={draft.saleRate} onChange={v => onChange({ saleRate: v })} style={{ fontFamily: 'JetBrains Mono, monospace' }} placeholder={t('priceAgreements.saleRateExample')} />
      </FieldRow>
      <FieldRow label={t('priceAgreements.validFrom')}>
        <TextField type="date" value={draft.validFrom} onChange={v => onChange({ validFrom: v })} />
      </FieldRow>
      <FieldRow label={t('priceAgreements.validUntil')}>
        <TextField type="date" value={draft.validUntil} onChange={v => onChange({ validUntil: v })} />
      </FieldRow>
      {/* Rich-text prose (Danny 2026-07-14 house rule) — the editor IS the form
          field here (form context), no separate pencil; SafeHtml renders it
          read-only wherever the agreement is shown (PriceAgreementRow). */}
      <FieldRow label={t('priceAgreements.remarks')}>
        <RichTextEditor value={draft.remarks} onChange={v => onChange({ remarks: v })}
          expanded={remarksExpanded} onToggleExpand={() => setRemarksExpanded(v => !v)} />
      </FieldRow>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {t('drawer.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} disabled={saving || !isDraftValid(draft, canSeeFinancial)}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
