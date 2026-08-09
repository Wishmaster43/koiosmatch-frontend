/**
 * BankAccountCard — the candidate's PRIVATE (salary) bank account: account
 * number (IBAN) + account holder. Danny 2026-08-09: "Financieel — 1.
 * Bankrekeningnummer en naam van rekeningnummer."
 *
 * WHERE IT LIVES: the Voorkeuren tab's existing "Financieel" sub-tab, stacked
 * between Loonheffing and Gewenst tarief — the salary account is the other half
 * of the payroll story that already sits there (loonheffing = how you are taxed,
 * bankrekening = where the money lands), while Gewenst tarief is a wish rather
 * than a payment fact. It is deliberately NOT the business account: the ZZP tab
 * keeps its own IBAN/tenaamstelling under Facturatie (Danny: a private salary
 * account is a different thing from the company's invoicing account).
 *
 * SHAPE: own pencil, own draft, own narrow save — the PREF-PENCIL-SPLIT-1 rule
 * this tab lives by. Built from the profileFieldShared atoms exactly like
 * EmergencyContactCard (its sibling bespoke card on this same tab), so the card
 * reads identically to the schema-driven EditableFieldTable cards around it.
 *
 * VALIDATION: none here beyond formatting. PATCH /candidates/{id} validates the
 * IBAN server-side (measured 2026-08-09: 422 "Het IBAN-controlegetal klopt
 * niet." on a bad check digit) and the drawer's shared patchCandidate already
 * reverts the optimistic value + shows that message through extractApiError. A
 * second, front-end mod-97 check would only be one more thing to drift.
 *
 * AVG (§8): financial personal data — rendered ONLY here, in the detail drawer.
 * It is not in the list resource (measured: GET /candidates returns no
 * iban/account_holder_name at all), never logged and never put in a URL.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { GroupCard, GroupHeader, FieldRow, inputStyle, iconBtn } from './profileFieldShared'
import { formatIban, normalizeIban } from '@/lib/iban'
import { useAuth } from '@/context/AuthContext'

export interface BankAccountValues {
  /** Stored wire form (no spaces) — shown grouped in fours, sent ungrouped. */
  iban: string
  accountHolderName: string
}

const EMPTY: BankAccountValues = { iban: '', accountHolderName: '' }

// An identifying number renders in JetBrains Mono (§4) — same treatment as the
// ZZP creditor number and the desired-rate fields on this tab.
const MONO = { fontFamily: 'JetBrains Mono, monospace' }

export default function BankAccountCard({ value, onSave }: {
  value: BankAccountValues
  onSave: (v: Record<string, unknown>) => void
}) {
  // FINANCIAL-GATE-1 (Danny 09-08, decided after we measured that NO permission
  // covered financial data at all): a bank account is least-privilege territory —
  // a recruiter calling a candidate has no business seeing where they get paid.
  // The backend is the real gate (it nulls these four fields without the
  // permission, default-deny); this hides the block so nobody stares at an
  // unexplained empty card. Hidden, not disabled: an empty field the viewer may
  // never fill is noise, and §7 says UI gating is UX only.
  const auth = useAuth()
  const { t } = useTranslation('candidates')
  // Bare-key convention (mirrors EmergencyContactCard's own header): this tab's
  // suite runs WITHOUT real i18n, where profileFieldShared's cross-namespace
  // `t('common:edit')` would render literally — a `useTranslation('common')`
  // instance + bare key stays correct in both modes.
  const { t: tc } = useTranslation('common')

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<BankAccountValues>({ ...EMPTY, ...value })

  // Enter edit mode with the READABLE (grouped) form in the input, so the value
  // is checked the way it is printed on a bank card.
  const start = () => { setForm({ iban: formatIban(value.iban), accountHolderName: value.accountHolderName ?? '' }); setEditing(true) }
  const cancel = () => { setForm({ ...EMPTY, ...value }); setEditing(false) }
  const setField = (k: keyof BankAccountValues, v: string) => setForm(p => ({ ...p, [k]: v }))
  // The ONE soft front-end hint (§: no second validator): leaving the field
  // tidies whatever was typed/pasted into uppercase groups of four. It says
  // nothing about whether the number is valid — the server decides that.
  const tidyIban = () => setForm(p => ({ ...p, iban: formatIban(p.iban) }))

  // Save sends the API shape straight up (PREF-PENCIL-SPLIT-1: only this card's
  // own keys). The IBAN goes out WITHOUT spaces — the backend stores what it is
  // sent verbatim (measured), so normalising here keeps the column canonical.
  const save = () => {
    onSave({ iban: normalizeIban(form.iban), account_holder_name: form.accountHolderName.trim() })
    setEditing(false)
  }

  const shownIban = formatIban(value.iban)

  // Hidden entirely without the permission — see FINANCIAL-GATE-1 above.
  if (!auth?.hasPermission?.('candidates.financial.view')) return null

  return (
    <div>
      <GroupHeader title={t('preferences.groupBankAccount')}>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={tc('save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }}><Save size={13} /></button>
            <button onClick={cancel} title={tc('cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={start} title={tc('edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
        )}
      </GroupHeader>
      <GroupCard>
        <FieldRow label={t('preferences.iban')}>
          {editing
            ? <input value={form.iban} onChange={e => setField('iban', e.target.value)} onBlur={tidyIban}
                aria-label={t('preferences.iban')} autoComplete="off" spellCheck={false}
                style={{ ...inputStyle, ...MONO }} />
            : <span style={{ fontSize: 12, color: shownIban ? 'var(--text)' : 'var(--text-muted)', ...(shownIban ? MONO : {}) }}>{shownIban || '-'}</span>}
        </FieldRow>
        <FieldRow label={t('preferences.accountHolderName')}>
          {editing
            ? <input value={form.accountHolderName} onChange={e => setField('accountHolderName', e.target.value)}
                aria-label={t('preferences.accountHolderName')} autoComplete="off" style={inputStyle} />
            : <span style={{ fontSize: 12, color: value.accountHolderName ? 'var(--text)' : 'var(--text-muted)' }}>{value.accountHolderName || '-'}</span>}
        </FieldRow>
      </GroupCard>
    </div>
  )
}
