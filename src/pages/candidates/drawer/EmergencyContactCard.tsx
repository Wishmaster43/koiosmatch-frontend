/**
 * EmergencyContactCard — the Voorkeuren tab's "Noodcontact" block (own pencil,
 * own draft — mirrors ZzpAddressCard's shape, not EditableFieldTable, because
 * the phone field needs its OWN live-on-blur validation + inline error, which
 * EditableFieldTable has no hook for). Saves ONLY its own two preference keys
 * (PREF-PENCIL-SPLIT-1 pattern) straight to the API shape the backend expects.
 *
 * VALIDATIE-LIVE-1: the phone field mirrors koiosmatch-api's `App\Rules\Phone`
 * (VALIDATIE-DIRECT-1) byte-for-byte — optional leading '+', digits/separators
 * only, 8-15 real digits once separators are stripped. Validation runs on
 * blur (immediate feedback) AND again on Save (so pressing Enter or clicking
 * Save without leaving the field still catches it). An invalid value BLOCKS
 * Save entirely: the typed text and its inline error both stay exactly as
 * they are — deliberately NOT the sibling ZzpTab business-email pattern,
 * which force-remounts on an invalid save and reverts the draft to the
 * stored value (see ZzpTab.test.tsx "reverts the draft on an invalid
 * format"). Here the draft is never reverted/wiped, on a client-side catch
 * or otherwise — the user always sees exactly what they typed until they
 * fix it or cancel.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { GroupCard, GroupHeader, FieldRow, inputStyle, iconBtn } from './profileFieldShared'

// Mirrors app/Rules/Phone.php exactly: optional leading '+', then digits and
// common separators (space/dash/parens/dot/slash) only.
const PHONE_SHAPE_RE = /^\+?[0-9][0-9 \-()./]*$/

// Pure validator (unit-testable in isolation) — empty is valid, the backend
// field is `nullable`; a non-empty value must match the shape AND hold
// 8-15 real digits once separators are stripped (ITU E.164 range).
export const isValidEmergencyPhone = (raw: string): boolean => {
  const v = raw.trim()
  if (!v) return true
  if (!PHONE_SHAPE_RE.test(v)) return false
  const digits = v.replace(/\D/g, '').length
  return digits >= 8 && digits <= 15
}

export interface EmergencyContactValues { name: string; phone: string }

export default function EmergencyContactCard({ value, onSave }: {
  value: EmergencyContactValues
  onSave: (v: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('candidates')
  // Bare-key convention (ZzpAddressCard's own file header explains why): this
  // tab's test suite runs WITHOUT real i18n, where the cross-namespace
  // `t('common:edit')` form (profileFieldShared's EditControls) renders
  // literally instead of resolving — `useTranslation('common')` + a bare key
  // stays correct in both the raw-key test fallback and real i18n.
  const { t: tc } = useTranslation('common')

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EmergencyContactValues>(value)
  const [phoneError, setPhoneError] = useState(false)

  const start = () => { setForm(value); setPhoneError(false); setEditing(true) }
  const cancel = () => { setForm(value); setPhoneError(false); setEditing(false) }
  // Live-on-blur: the primary interactive feedback loop for VALIDATIE-LIVE-1.
  const blurPhone = () => setPhoneError(!isValidEmergencyPhone(form.phone))
  const setPhone = (v: string) => { setForm(p => ({ ...p, phone: v })); if (phoneError) setPhoneError(false) }
  // Save re-validates regardless of blur history (Enter / a direct Save click
  // without leaving the field must still be caught) and blocks on failure —
  // the draft and its error both stay visible, nothing is reverted.
  const save = () => {
    if (!isValidEmergencyPhone(form.phone)) { setPhoneError(true); return }
    onSave({ emergency_contact_name: form.name, emergency_contact_phone: form.phone })
    setEditing(false)
  }

  return (
    <div>
      <GroupHeader title={t('preferences.groupEmergencyContact')}>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={tc('save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
            <button onClick={cancel} title={tc('cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={start} title={tc('edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
        )}
      </GroupHeader>
      <GroupCard>
        <FieldRow label={t('preferences.emergencyContactName')}>
          {editing
            ? <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                aria-label={t('preferences.emergencyContactName')} style={inputStyle} />
            : <span style={{ fontSize: 12, color: value.name ? 'var(--text)' : 'var(--text-muted)' }}>{value.name || '-'}</span>}
        </FieldRow>
        <FieldRow label={t('preferences.emergencyContactPhone')}
          errorText={phoneError ? t('preferences.emergencyContactPhoneInvalid') : undefined}>
          {editing
            ? <input value={form.phone} onChange={e => setPhone(e.target.value)} onBlur={blurPhone}
                aria-label={t('preferences.emergencyContactPhone')} aria-invalid={phoneError} style={inputStyle} />
            : <span style={{ fontSize: 12, color: value.phone ? 'var(--text)' : 'var(--text-muted)' }}>{value.phone || '-'}</span>}
        </FieldRow>
      </GroupCard>
    </div>
  )
}
