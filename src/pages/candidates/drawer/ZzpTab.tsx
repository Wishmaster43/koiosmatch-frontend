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
 *
 * BANK-1 (Danny 2026-08-09, point 2) — Facturatie gains the TENAAMSTELLING next
 * to its existing IBAN (`freelance.account_holder_name`, CMBE 03ba8ec9). Both
 * account numbers in the app share `lib/iban`: displayed in groups of four,
 * stored/sent without spaces, validated server-side only.
 *
 * 1.1.4 (creditor number, ZZP-CREDITOR-SEQ-1) — CREDITOR-AUTO-1: the field
 * becomes READ-ONLY once the tenant's own numbering sequence owns it
 * (Settings → Nummering, `useNumberingEntities`, entity key `zzp_creditor`).
 * RE-VERIFIED LIVE 2026-08-07 (tenant `yesway`, GET /numbering-entities against
 * the running dev API): the entity now DOES exist there (`CR`, pad 3) — the
 * 2026-08 gap this comment used to describe is closed, so `creditorAutoNumbered`
 * below now resolves true and the field renders as the read-only row further
 * down (never the editable one). Cross-checked against the write side too:
 * `CandidateFreelanceProfile::booted()` (koiosmatch-api) allocates the next
 * `CR-xxx` via `ReferenceNumberAllocator` on every save where the column is
 * still blank — platform-wide config (`config/numbering.php`), not a
 * per-tenant toggle, so this reads the same for every tenant. The check stays
 * LIVE (never hardcoded to true) so a future config change is still honoured
 * with zero FE edit — exactly the contract this tab always had, just now
 * resolving to "yes" instead of "unknown". Separately: the backend auto-fills
 * a BLANK creditor number on save (its own numbering sequence) — the
 * optimistic onUpdate above only echoes back what was TYPED, so a still-empty
 * field would keep showing blank until the drawer is reopened. This tab
 * re-reads the record itself in that one case (fetchDetail) and shows the
 * fresh number locally until the parent's own state catches up.
 */
import { useEffect, useRef, useState } from 'react'
import IbanDocumentSlot from './IbanDocumentSlot'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import EditableFieldTableJs from '@/components/forms/EditableFieldTable'
import { kvkValue, vatValue } from '@/components/drawer/contactLinks'
import { formatIban, normalizeIban } from '@/lib/iban'
import { useAuth } from '@/context/AuthContext'
import { useConfirm } from '@/hooks/useConfirm'
import { notifyError } from '@/lib/notify'
import { useNumberingEntities } from '@/lib/useNumberingEntities'
import { useIdentifierValidation } from '@/hooks/useIdentifierValidation'
import { resolveCountryCode } from '@/lib/companyIdentifiers'
// HUISSTIJL-1: the shared JetBrains Mono atom + the muted-caption atom (identity-only swaps).
import { Mono, Caption } from '@/components/ui/typography'
import ZzpAddressCard from './ZzpAddressCard'
import type { ZzpAddressValues } from './ZzpAddressCard'
import { useBusinessEmailDuplicateCheck } from '../hooks/useBusinessEmailDuplicateCheck'
import { useCandidateRecord } from '../hooks/useCandidateMutations'
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

  // CREDITOR-AUTO-1: "is the creditor number on the tenant's numbering sequence?"
  // — the only place the FE can check is the numbering-entities lookup; a
  // `zzp_creditor` entry there is the honest signal (see the file header).
  const { entities: numberingEntities } = useNumberingEntities()
  const creditorAutoNumbered = numberingEntities.some(e => e.key === 'zzp_creditor')

  // Local override for a creditor number the BACKEND filled in on a blank save —
  // reset the moment a different candidate is shown so a stale fetched number can
  // never leak onto the next dossier (mirrors CandidateDrawer's own prevId reset).
  const [creditorOverride, setCreditorOverride] = useState<string | null>(null)
  const [prevCandidateId, setPrevCandidateId] = useState(c.id)
  if (c.id !== prevCandidateId) { setPrevCandidateId(c.id); setCreditorOverride(null) }
  // Always-current candidate id for the async resolution below — a plain closure
  // over `c.id` would still read the id from the render the save happened in.
  // Updated in an effect (never during render — refs are for event handlers/effects).
  const candidateIdRef = useRef(c.id)
  useEffect(() => { candidateIdRef.current = c.id }, [c.id])
  // Re-armed in effect SETUP (§9): StrictMode's setup→cleanup→setup must never
  // leave this permanently false.
  const mountedRef = useRef(false)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  const { fetchDetail } = useCandidateRecord()
  // Re-read just this one record and adopt the fresh creditor number, if any —
  // ignored if the drawer moved to another candidate or unmounted meanwhile.
  const refreshCreditorNumber = (forId: typeof c.id) => {
    void (async () => {
      const fresh = await fetchDetail(forId)
      if (!mountedRef.current || candidateIdRef.current !== forId) return
      if (fresh && fresh !== 'gone') {
        const num = (fresh.zzp as Record<string, unknown> | undefined)?.creditor_number
        if (num) setCreditorOverride(String(num))
      }
    })()
  }

  // Bedrijf/Facturatie values — the address block below owns its own values now
  // (ZzpAddressCard), so this object no longer carries street/postcode/etc.
  const value = {
    bedrijfsnaam:   zzp.company_name    ?? flat.company_name ?? '',
    kvk:            zzp.kvk_number      ?? flat.kvk          ?? '',
    btw:            zzp.vat_number      ?? flat.btw          ?? '',
    kor:            zzp.kor             ?? flat.kor          ?? false,
    crediteur:      creditorOverride    ?? zzp.creditor_number ?? '',
    email_zakelijk: zzp.business_email  ?? '',
    // BANK-1: the BUSINESS account. The IBAN reads (and edits) in readable
    // groups of four but is STORED ungrouped — the API keeps whatever string it
    // is sent (measured), so handleSaveInvoicing normalises it again on save.
    // The legacy `flat.iban` fallback that used to sit here is GONE ON PURPOSE:
    // since BANK-1 a top-level `iban` on the record is the candidate's PRIVATE
    // salary account (mapCandidate), so keeping it would render — and, on the
    // next Facturatie save, WRITE — the private account as the company's one.
    // Two accounts, two sources, never a fallback between them.
    iban:           formatIban(zzp.iban ?? ''),
    // Tenaamstelling (Danny 2026-08-09, point 2) — CMBE 03ba8ec9 added
    // `freelance.account_holder_name`; measured live the same day.
    tenaamstelling: zzp.account_holder_name ?? '',
  }
  // KVK/BTW-PER-LAND-1 (Danny 08-08, points 10 + 11): the KvK/BTW shape follows the
  // freelancer's OWN business country (the Adres block below), never a hardcoded
  // Dutch rule; the tenant setting decides warn-vs-block. MEASURED 08-08 against the
  // dev API: PATCH /candidates/{id} still validates `freelance.kvk_number` as
  // `digits:8` and `freelance.vat_number` as `/^NL\d{9}B\d{2}$/`, so a non-Dutch
  // number is refused server-side regardless of this setting — the honest hint under
  // the card says exactly that instead of pretending the save will land.
  const auth = useAuth()
  const identifiers = useIdentifierValidation()
  const zzpCountry = (zzp.country as string) ?? ''
  const zzpCountryCode = resolveCountryCode(zzpCountry)
  const backendNlOnly = zzpCountryCode !== null && zzpCountryCode !== 'NL'
  // FINANCIAL-GATE-1: same permission as the candidate's private bank card.
  const canSeeFinancial = auth?.hasPermission?.('candidates.financial.view') ?? false
  const fields = [
    { key: 'bedrijfsnaam', label: t('zzp.companyName'), group: t('zzp.groupCompany') },
    // 69-17: KVK/BTW/KOR moved from Bedrijf to Financieel (renamed from Facturatie,
    // see zzp.groupInvoicing's own translation) — same fields, same hyperlink
    // renderers/validation, only the card they live in changed.
    { key: 'kvk', label: t('zzp.kvk'), group: t('zzp.groupInvoicing'),
      renderValue: (v: unknown) => kvkValue(v, t('zzp.openKvk')),
      validate: (v: unknown) => identifiers.notice('coc', v as string, zzpCountry) },
    { key: 'btw', label: t('zzp.vat'), group: t('zzp.groupInvoicing'),
      renderValue: (v: unknown) => vatValue(v, t('zzp.openVies')),
      validate: (v: unknown) => identifiers.notice('vat', v as string, zzpCountry) },
    { key: 'kor', label: t('zzp.kor'), group: t('zzp.groupInvoicing'), type: 'checkbox' },
    // CREDITOR-AUTO-1: only offered as an editable row while the tenant does NOT
    // run it through the numbering sequence — once it does, it renders as its
    // own read-only row instead (see the JSX below), never as an input here.
    ...(creditorAutoNumbered ? [] : [{ key: 'crediteur', label: t('zzp.creditor'), group: t('zzp.groupInvoicing') }]),
    { key: 'email_zakelijk', label: t('zzp.businessEmail'), group: t('zzp.groupInvoicing'), inputType: 'email' },
    // An account number is an identifying number → JetBrains Mono (§4). No
    // client-side mod-97 check: the backend validates it (422 "Het
    // IBAN-controlegetal klopt niet.", measured on `freelance.iban`) and the
    // drawer's patchCandidate already surfaces that message via extractApiError.
    // FINANCIAL-GATE-1: the account number + holder are gated on
    // `candidates.financial.view` (Danny 09-08). The backend nulls both fields
    // without it, so showing the rows would only ever render two empty values a
    // viewer cannot explain or fill. Same permission as the candidate's private
    // account card — one rule, both accounts.
    ...(canSeeFinancial ? [
      { key: 'iban', label: t('zzp.iban'), group: t('zzp.groupInvoicing'), mono: true },
      // Danny 2026-08-09, point 2: the tenaamstelling next to the existing IBAN —
      // one row added, nothing else in this block moved.
      { key: 'tenaamstelling', label: t('zzp.accountHolderName'), group: t('zzp.groupInvoicing') },
    ] : []),
  ]
  const blockFields = (group: string) => fields.filter(f => f.group === group).map(f => ({ ...f, group: undefined }))

  // Bedrijf and Facturatie now save SEPARATELY (each narrower than the old
  // shared toApi, which used to ride the full 12-key ZZP object along on every
  // block's save) — Facturatie needs its own async validation gate below, which
  // must never run just because Bedrijf's KVK/BTW/KOR were edited.
  // 69-17: kvk/btw/kor moved out of this card (now saved by handleSaveInvoicing
  // below, alongside the rest of the Financieel card) — Bedrijf now only owns
  // the company name.
  const handleSaveCompany = (v: Record<string, unknown>) => onSave?.({
    company_name: v.bedrijfsnaam,
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
    const commit = () => {
      // BANK-1: the IBAN goes out WITHOUT spaces (the API stores the string
      // verbatim), the tenaamstelling trimmed — the readable grouping is a
      // display concern only.
      onSave?.({
        // 69-17: kvk/btw/kor now live in this same Financieel card — still a plain
        // patch alongside the rest, the async duplicate-check gate below only ever
        // keys off business_email, so a kvk/btw-only edit never triggers it.
        creditor_number: v.crediteur, business_email: v.email_zakelijk,
        iban: normalizeIban(v.iban), account_holder_name: String(v.tenaamstelling ?? '').trim(),
        kvk_number: v.kvk, vat_number: v.btw, kor: v.kor,
      })
      // CREDITOR-AUTO-1: only worth a re-read when it was submitted BLANK — that
      // is the one case the backend fills in behind the optimistic patch above.
      if (!String(v.crediteur ?? '').trim()) refreshCreditorNumber(c.id)
    }
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
      {/* Honest gap notice (§3): the FE now checks per country, the backend does not —
          a non-Dutch KvK/BTW is still refused by PATCH /candidates/{id} (measured 08-08). */}
      {backendNlOnly && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--color-warning)', padding: '0 12px' }}>{t('zzp.identifierNlOnly')}</div>
      )}
      <ZzpAddressCard value={addressValue} onSave={handleSaveAddress} />
      {/* CREDITOR-AUTO-1 locked row — only rendered once the tenant's numbering
          sequence actually owns this field (see creditorAutoNumbered above);
          styled to match the calm EditableFieldTable card look (CANON-BOX). */}
      {creditorAutoNumbered && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)',
          padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
            {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render. */}
            <Caption style={{ width: WIDE_LABEL_WIDTH, flexShrink: 0 }}>{t('zzp.creditor')}</Caption>
            {/* HUISSTIJL-1: identical fontFamily/size/colour render (colour stays
                the same live ternary — the atom does not fix a colour). */}
            <Mono style={{ fontSize: 12, color: value.crediteur ? 'var(--text)' : 'var(--text-muted)' }}>
              {(value.crediteur as string) || '-'}
            </Mono>
          </div>
          {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
          <Caption as="div" style={{ fontStyle: 'italic' }}>{t('zzp.creditorAutoLocked')}</Caption>
        </div>
      )}
      <EditableFieldTable key={`invoicing-${invoicingEpoch}`} title={t('zzp.groupInvoicing')} fields={blockFields(t('zzp.groupInvoicing'))} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveInvoicing} />
      {/* DOC-BANK-2: proof document for the BUSINESS account — same slot as the
          private card, writing freelance.bank_document_id (explicit null clears;
          an omitted key changes nothing — CMBE-measured `sometimes|nullable`).
          Always rendered: a candidate WITHOUT a freelance profile yet must
          still be able to link (the PATCH updateOrCreates the profile). */}
      {(
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)',
          padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
          <Caption style={{ width: WIDE_LABEL_WIDTH, flexShrink: 0 }}>{t('zzp.bankDocument')}</Caption>
          <IbanDocumentSlot candidateId={c.id} documents={(c as { documents?: Record<string, unknown>[] }).documents ?? []}
            linkedDocumentId={(zzp?.bank_document_id as string | number | null | undefined) ?? null}
            preferredType="Bankpas zakelijk"
            onLink={(id) => onSave?.({ bank_document_id: id })} />
        </div>
      )}
      {/* Defensive fallback (CREDITOR-AUTO-1): the numbering-entities read IS live
          now (see file header, re-verified 2026-08-07) and resolves true for every
          tenant today — this branch is dead in practice, kept only so a future
          config change (the entity ever removed) still degrades honestly to an
          editable field + hint instead of a silently-blank row. */}
      {/* HUISSTIJL-1: identical 11/400/var(--text-muted) render as a div. */}
      {!creditorAutoNumbered && !value.crediteur && (
        <Caption as="div" style={{ fontStyle: 'italic', padding: '0 12px' }}>{t('zzp.creditorAutoHint')}</Caption>
      )}
      {dialog}
    </div>
  )
}

export default ZzpTab
