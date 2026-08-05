/**
 * ZzpTab — the candidate drawer's Freelance (ZZP) tab. Three blocks — Bedrijf ·
 * Adres · Facturatie — each with its own pencil and its own title ABOVE its card
 * (Danny 28-07: "ZZP zonder sub tabjes, 3 potlootjes per blokje en de txt
 * erbuiten"). Split out of PreferencesZzpTabs.tsx (Danny 05-08, points 1.1.1-1.1.5)
 * once the four new requirements below pushed that shared file past the ~400-line
 * split trigger (§3) — PreferencesZzpTabs.tsx re-exports this so CandidateDrawer's
 * existing import keeps working unchanged.
 *
 * 1.1.1/1.1.2 — Adres collapses to one composed line (own component, see
 * ZzpAddressCard's file header for why it isn't built on EditableFieldTable).
 * 1.1.2/1.1.3 — KVK/BTW render as real hyperlinks via the shared contactLinks
 * renderers (mirrors the customer OverviewTab, never a new copy).
 * 1.1.5 — the business e-mail gets a client-side format check plus an async,
 * ON-SAVE-ONLY duplicate warning (never a hard block, §3 "prompt, don't
 * hard-block") via useBusinessEmailDuplicateCheck.
 * 1.1.4 (creditor number) is explicitly OUT of scope here — separate backend
 * sequence ticket.
 */
import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import EditableFieldTableJs from '@/components/forms/EditableFieldTable'
import { kvkValue, vatValue } from '@/components/drawer/contactLinks'
import { useConfirm } from '@/hooks/useConfirm'
import { notifyError } from '@/lib/notify'
import ZzpAddressCard from './ZzpAddressCard'
import type { ZzpAddressValues } from './ZzpAddressCard'
import { useBusinessEmailDuplicateCheck } from '../hooks/useBusinessEmailDuplicateCheck'
import { WIDE_LABEL_WIDTH } from './PreferencesZzpTabs'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// EditableFieldTable is still untyped JS — accept any props at the boundary.
const EditableFieldTable = EditableFieldTableJs as unknown as ComponentType<AnyProps>

// Simple RFC-lite format check (task 1.1.5) — no existing email-format helper
// found anywhere in the repo (checked src/lib, src/hooks); good enough to catch
// "not even shaped like an e-mail" without pulling in a full validator library.
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ZzpTab({ c, onSave }: { c: Candidate; onSave?: (v: Record<string, unknown>) => void }) {
  const { t } = useTranslation('candidates')
  const zzp = c.zzp
  // Legacy fallbacks live on the flat candidate record (not on the typed model).
  const flat = c as unknown as Record<string, unknown>
  // Bedrijf/Facturatie values — the address block below owns its own values now
  // (ZzpAddressCard), so this object no longer carries street/postcode/etc.
  const value = {
    bedrijfsnaam:   zzp.company_name    ?? flat.company_name ?? '',
    kvk:            zzp.kvk_number      ?? flat.kvk          ?? '',
    btw:            zzp.vat_number      ?? flat.btw          ?? '',
    kor:            zzp.kor             ?? flat.kor          ?? false,
    crediteur:      zzp.creditor_number ?? '',
    email_zakelijk: zzp.business_email  ?? '',
    iban:           zzp.iban            ?? flat.iban         ?? '',
  }
  const fields = [
    { key: 'bedrijfsnaam', label: t('zzp.companyName'), group: t('zzp.groupCompany') },
    // KVK/BTW render as real hyperlinks in read mode (task 1.1.2/1.1.3) — same
    // shared renderers the customer OverviewTab uses, edit mode stays a plain input.
    { key: 'kvk', label: t('zzp.kvk'), group: t('zzp.groupCompany'),
      renderValue: (v: unknown) => kvkValue(v, t('zzp.openKvk')) },
    { key: 'btw', label: t('zzp.vat'), group: t('zzp.groupCompany'),
      renderValue: (v: unknown) => vatValue(v, t('zzp.openVies')) },
    { key: 'kor', label: t('zzp.kor'), group: t('zzp.groupCompany'), type: 'checkbox' },
    // 1.1.4 (creditor number) is a separate backend sequence ticket — left untouched.
    { key: 'crediteur', label: t('zzp.creditor'), group: t('zzp.groupInvoicing') },
    { key: 'email_zakelijk', label: t('zzp.businessEmail'), group: t('zzp.groupInvoicing'), inputType: 'email' },
    { key: 'iban', label: t('zzp.iban'), group: t('zzp.groupInvoicing') },
  ]
  const blockFields = (group: string) => fields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))

  // Bedrijf and Facturatie now save SEPARATELY (each narrower than the old
  // shared toApi, which used to ride the full 12-key ZZP object along on every
  // block's save) — Facturatie needs its own async validation gate below, which
  // must never run just because Bedrijf's KVK/BTW/KOR were edited.
  const handleSaveCompany = (v: Record<string, unknown>) => onSave?.({
    company_name: v.bedrijfsnaam, kvk_number: v.kvk, vat_number: v.btw, kor: v.kor,
  })

  // Adres — own component + own save call (see ZzpAddressCard's file header for
  // why it can't be a plain FieldRow pair inside EditableFieldTable).
  const addressValue: ZzpAddressValues = {
    street:            (zzp.street as string)              ?? '',
    houseNumber:       (zzp.house_number as string)         ?? '',
    houseNumberSuffix: (zzp.house_number_suffix as string)  ?? '',
    postalCode:        (zzp.postal_code as string)          ?? '',
    city:              (zzp.city as string)                 ?? '',
    province:          (zzp.province as string)             ?? '',
    country:           (zzp.country as string)              ?? '',
  }
  const handleSaveAddress = (v: ZzpAddressValues) => onSave?.({
    street: v.street, house_number: v.houseNumber, house_number_suffix: v.houseNumberSuffix,
    postal_code: v.postalCode, city: v.city, province: v.province, country: v.country,
  })

  // BUSINESS-EMAIL-DUP-1 (task 1.1.5): format check + an async, on-save-only
  // duplicate WARNING (never a hard block, §3 "prompt, don't hard-block").
  const { checkDuplicate } = useBusinessEmailDuplicateCheck(c.id)
  const { confirm, dialog } = useConfirm()
  // Bumped to REMOUNT the Facturatie table when an invalid/declined save must
  // revert the shown draft back to the real stored value — EditableFieldTable
  // always flips to read mode + keeps the typed draft on Save regardless of what
  // the parent's onSave does, so a rejected save needs a forced re-sync (mirrors
  // ContactDetail's own tableEpoch for its declined primary-contact swap).
  const [invoicingEpoch, setInvoicingEpoch] = useState(0)
  const originalEmail = String(value.email_zakelijk ?? '').trim()

  const handleSaveInvoicing = (v: Record<string, unknown>) => {
    const commit = () => onSave?.({ creditor_number: v.crediteur, business_email: v.email_zakelijk, iban: v.iban })
    const email = String(v.email_zakelijk ?? '').trim()
    if (!email) { commit(); return }
    if (!EMAIL_FORMAT_RE.test(email)) {
      notifyError(t('zzp.businessEmailInvalid'))
      setInvoicingEpoch(e => e + 1)
      return
    }
    // Only probe when the e-mail actually CHANGED — never re-warn about an
    // unchanged, already-accepted value just because IBAN/creditor were edited,
    // and never fire the check per keystroke (it runs once, right here, on save).
    if (email === originalEmail) { commit(); return }
    void (async () => {
      const dup = await checkDuplicate(email)
      if (!dup) { commit(); return }
      confirm(t('zzp.businessEmailDuplicateBody', { name: dup.name || t('duplicate.unnamed') }), commit, {
        title: t('zzp.businessEmailDuplicateTitle'),
        confirmLabel: t('zzp.businessEmailDuplicateConfirm'),
        cancelLabel: t('zzp.businessEmailDuplicateCancel'),
        onCancel: () => setInvoicingEpoch(e => e + 1),
      })
    })()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <EditableFieldTable title={t('zzp.groupCompany')} fields={blockFields(t('zzp.groupCompany'))} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveCompany} />
      <ZzpAddressCard value={addressValue} onSave={handleSaveAddress} />
      <EditableFieldTable key={`invoicing-${invoicingEpoch}`} title={t('zzp.groupInvoicing')} fields={blockFields(t('zzp.groupInvoicing'))} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveInvoicing} />
      {dialog}
    </div>
  )
}

export default ZzpTab
