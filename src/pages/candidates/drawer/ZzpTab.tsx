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
 * 1.1.4 (creditor number, ZZP-CREDITOR-SEQ-1) — CREDITOR-AUTO-1: the field
 * becomes READ-ONLY once the tenant's own numbering sequence owns it
 * (Settings → Nummering, `useNumberingEntities`, entity key `zzp_creditor`).
 * That entity does not exist in the numbering-entities list yet (confirmed
 * live 2026-08 — the backend hasn't wired it up there), so the FE genuinely
 * cannot assert "on auto" today; the field stays EDITABLE with a muted
 * "auto-assigned if left empty" hint instead of guessing. The check itself
 * stays live so the day the backend adds that entity, this tab reacts with
 * zero further FE change. Separately: the backend auto-fills a BLANK creditor
 * number on save (its own numbering sequence) — the optimistic onUpdate above
 * only echoes back what was TYPED, so a still-empty field would keep showing
 * blank until the drawer is reopened. This tab re-reads the record itself in
 * that one case (fetchDetail) and shows the fresh number locally until the
 * parent's own state catches up.
 */
import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import EditableFieldTableJs from '@/components/forms/EditableFieldTable'
import { kvkValue, vatValue } from '@/components/drawer/contactLinks'
import { useConfirm } from '@/hooks/useConfirm'
import { notifyError } from '@/lib/notify'
import { useNumberingEntities } from '@/lib/useNumberingEntities'
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
    // CREDITOR-AUTO-1: only offered as an editable row while the tenant does NOT
    // run it through the numbering sequence — once it does, it renders as its
    // own read-only row instead (see the JSX below), never as an input here.
    ...(creditorAutoNumbered ? [] : [{ key: 'crediteur', label: t('zzp.creditor'), group: t('zzp.groupInvoicing') }]),
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
    const commit = () => {
      onSave?.({ creditor_number: v.crediteur, business_email: v.email_zakelijk, iban: v.iban })
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
      <ZzpAddressCard value={addressValue} onSave={handleSaveAddress} />
      {/* CREDITOR-AUTO-1 locked row — only rendered once the tenant's numbering
          sequence actually owns this field (see creditorAutoNumbered above);
          styled to match the calm EditableFieldTable card look (CANON-BOX). */}
      {creditorAutoNumbered && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)',
          padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: WIDE_LABEL_WIDTH, flexShrink: 0 }}>{t('zzp.creditor')}</span>
            <span style={{ fontSize: 12, color: value.crediteur ? 'var(--text)' : 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {(value.crediteur as string) || '-'}
            </span>
          </div>
          <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('zzp.creditorAutoLocked')}</div>
        </div>
      )}
      <EditableFieldTable key={`invoicing-${invoicingEpoch}`} title={t('zzp.groupInvoicing')} fields={blockFields(t('zzp.groupInvoicing'))} value={value} labelWidth={WIDE_LABEL_WIDTH} onSave={handleSaveInvoicing} />
      {/* Honest fallback (CREDITOR-AUTO-1): the FE cannot confirm the tenant's
          numbering state yet (see file header), so the field stays editable and
          this is the whole story — no guessing at a mode that isn't exposed. */}
      {!creditorAutoNumbered && !value.crediteur && (
        <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', padding: '0 12px' }}>{t('zzp.creditorAutoHint')}</div>
      )}
      {dialog}
    </div>
  )
}

export default ZzpTab
