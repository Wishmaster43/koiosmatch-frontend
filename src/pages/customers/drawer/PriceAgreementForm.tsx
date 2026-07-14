/**
 * PriceAgreementForm — the shared field-set for both "add" (PriceAgreementsTab) and
 * "edit" (PriceAgreementRow) — one place to keep the fields in sync. function_title
 * and cao are tenant lookups (useFunctions/useCao) with an explicit "any" option at
 * the top, since each of function_title/cao/scale/step is an optional wildcard match
 * criterion on the backend (§ MATCH-PLC price-agreements). Mirrors the contract/
 * financial field layout of MatchPlacementModal.
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import SelectMenu from '@/components/ui/SelectMenu'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { useFunctions } from '@/lib/useFunctions'
import { useCao } from '@/lib/useCao'
import type { PriceAgreement, PriceAgreementPayload } from '../hooks/usePriceAgreements'

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

export const isDraftValid = (d: PriceAgreementDraft): boolean => d.purchaseRate.trim() !== '' && d.validFrom.trim() !== ''

const lbl: CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }
const input: CSSProperties = { width: '100%', height: 34, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const row2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

// A labelled field wrapper — mirrors MatchPlacementModal's F().
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={lbl}>{label}</div>{children}</div>
}

interface PriceAgreementFormProps {
  draft: PriceAgreementDraft
  onChange: (patch: Partial<PriceAgreementDraft>) => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  saving?: boolean
}

export default function PriceAgreementForm({ draft, onChange, onSave, onCancel, saveLabel, saving }: PriceAgreementFormProps) {
  const { t } = useTranslation('customers')
  const { functions } = useFunctions()
  const { types: caoTypes } = useCao()

  // "Any" sits first in both lookups — selecting it clears the wildcard field.
  const functionOptions = [{ value: '', label: t('priceAgreements.any') }, ...functions.map(f => ({ value: f, label: f }))]
  const caoOptions = [{ value: '', label: t('priceAgreements.any') }, ...caoTypes.map(c => ({ value: c.value, label: c.label }))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={row2}>
        <Field label={t('priceAgreements.function')}>
          <SelectMenu value={draft.functionTitle} onChange={v => onChange({ functionTitle: v })} options={functionOptions} placeholder={t('priceAgreements.any')} />
        </Field>
        <Field label={t('priceAgreements.cao')}>
          <SelectMenu value={draft.cao} onChange={v => onChange({ cao: v })} options={caoOptions} placeholder={t('priceAgreements.any')} />
        </Field>
      </div>
      <div style={row2}>
        <Field label={t('priceAgreements.scale')}>
          <input value={draft.scale} onChange={e => onChange({ scale: e.target.value })} style={input} placeholder={t('priceAgreements.any')} />
        </Field>
        <Field label={t('priceAgreements.step')}>
          <input value={draft.step} onChange={e => onChange({ step: e.target.value })} style={input} placeholder={t('priceAgreements.any')} />
        </Field>
      </div>
      <div style={row2}>
        <Field label={t('priceAgreements.purchaseRate')}>
          <input type="number" step="0.01" min={0} value={draft.purchaseRate} onChange={e => onChange({ purchaseRate: e.target.value })} style={{ ...input, fontFamily: 'JetBrains Mono, monospace' }} placeholder="22.18" />
        </Field>
        <Field label={t('priceAgreements.saleRate')}>
          <input type="number" step="0.01" min={0} value={draft.saleRate} onChange={e => onChange({ saleRate: e.target.value })} style={{ ...input, fontFamily: 'JetBrains Mono, monospace' }} placeholder="31.10" />
        </Field>
      </div>
      <div style={row2}>
        <Field label={t('priceAgreements.validFrom')}>
          <input type="date" value={draft.validFrom} onChange={e => onChange({ validFrom: e.target.value })} style={input} />
        </Field>
        <Field label={t('priceAgreements.validUntil')}>
          <input type="date" value={draft.validUntil} onChange={e => onChange({ validUntil: e.target.value })} style={input} />
        </Field>
      </div>
      {/* Rich-text prose (Danny 2026-07-14 house rule) — the editor IS the form
          field here (form context), no separate pencil; SafeHtml renders it
          read-only wherever the agreement is shown (PriceAgreementRow). */}
      <Field label={t('priceAgreements.remarks')}>
        <RichTextEditor value={draft.remarks} onChange={v => onChange({ remarks: v })} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
        <button onClick={onCancel} style={{ height: 30, padding: '0 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          {t('drawer.cancel')}
        </button>
        <button onClick={onSave} disabled={saving || !isDraftValid(draft)}
          style={{ height: 30, padding: '0 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 7, background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', opacity: isDraftValid(draft) ? 1 : 0.4 }}>
          {saveLabel}
        </button>
      </div>
    </div>
  )
}
