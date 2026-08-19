/**
 * EmergencyContactCard — the Voorkeuren tab's "Noodcontact" block (own pencil,
 * own draft — mirrors ZzpAddressCard's shape: read mode collapses to ONE
 * composed line, edit mode expands to the loose fields). Saves ONLY its own
 * preference keys (PREF-PENCIL-SPLIT-1 pattern) straight to the API shape the
 * backend expects.
 *
 * NOODCONTACT-SPLIT-1 (Danny 2026-08-08 live: "voornaam achternaam
 * tussenvoegsel mobiel en telefoonnummer ... zoekbare dropdown [voor] de
 * relatie"). CMBE shipped the split contract (commit 2b960523) — measured +
 * PROVEN live against koiosmatch-api (see the PATCH proof in the delivery
 * report): `candidate_preferences` now carries `emergency_contact_first_name` /
 * `_middle_name` / `_last_name` (mirrors candidates.first_name/middle_name/
 * last_name — MIDDLE_NAME, not "infix"), `emergency_contact_phone` +
 * `emergency_contact_mobile` (both Phone-rule), and `emergency_contact_relation_id`
 * — a tenant lookup referenced BY ROW ID (verified: sending the label/slug
 * instead of the id 422s "must be a valid UUID"). The OLD single
 * `emergency_contact_name` / free-text `emergency_contact_relation` fields no
 * longer exist server-side. The relation lookup's nested `{id,label}` response
 * (KAND-NIVEAU-1's educations.level pattern) lets read mode show a stored
 * relation without a second fetch — see `relationLabel` below.
 *
 * VALIDATIE-LIVE-1: phone AND mobile both mirror koiosmatch-api's `App\Rules\Phone`
 * (same rule on both columns) via the SHARED `isValidPhoneFormat` (adopted from
 * `contactFieldValidation.ts` — the candidate's own Contact tab already validates
 * its phone/mobile with the exact same check; this card used to carry its own
 * duplicate copy of that one regex, now removed, CLAUDE.md §11). Validation runs
 * on blur (immediate feedback) AND again on Save (so pressing Enter or clicking
 * Save without leaving the field still catches it). An invalid value BLOCKS
 * Save entirely: the typed text and its inline error both stay exactly as they
 * are — the draft is never reverted/wiped, on a client-side catch or otherwise.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { GroupCard, GroupHeader, FieldRow, inputStyle } from './profileFieldShared'
import { isValidPhoneFormat } from '../lib/contactFieldValidation'
import { useEmergencyContactRelations } from '@/lib/useEmergencyContactRelations'
import Button from '@/components/ui/Button'

export interface EmergencyContactValues {
  firstName: string
  middleName: string
  lastName: string
  phone: string
  mobile: string
  // The tenant lookup row id (never the slug/label) — what the save path sends.
  relationId: string
  // The server's nested {id,label}.label for the CURRENTLY stored relation — read
  // mode's fallback display when the id isn't (yet) present in the loaded lookup.
  relationLabel: string
}

const EMPTY: EmergencyContactValues = {
  firstName: '', middleName: '', lastName: '', phone: '', mobile: '', relationId: '', relationLabel: '',
}

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
  // Relation lookup — searchable, pick-only dropdown (CLAUDE.md §4: never a
  // native <select> or a hardcoded option list).
  const { emergencyContactRelations } = useEmergencyContactRelations()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EmergencyContactValues>({ ...EMPTY, ...value })
  const [phoneError, setPhoneError] = useState(false)
  const [mobileError, setMobileError] = useState(false)

  const start = () => { setForm({ ...EMPTY, ...value }); setPhoneError(false); setMobileError(false); setEditing(true) }
  const cancel = () => { setForm({ ...EMPTY, ...value }); setPhoneError(false); setMobileError(false); setEditing(false) }
  const setField = (k: keyof EmergencyContactValues, v: string) => setForm(p => ({ ...p, [k]: v }))
  // Live-on-blur: the primary interactive feedback loop for VALIDATIE-LIVE-1,
  // now covering BOTH phone columns (they share the exact same backend rule).
  const blurPhone  = () => setPhoneError(!isValidPhoneFormat(form.phone))
  const blurMobile = () => setMobileError(!isValidPhoneFormat(form.mobile))
  const setPhone  = (v: string) => { setField('phone', v); if (phoneError) setPhoneError(false) }
  const setMobile = (v: string) => { setField('mobile', v); if (mobileError) setMobileError(false) }

  // Save re-validates regardless of blur history (Enter / a direct Save click
  // without leaving the field must still be caught) and blocks on failure —
  // the draft and its error(s) both stay visible, nothing is reverted.
  const save = () => {
    const phoneBad = !isValidPhoneFormat(form.phone)
    const mobileBad = !isValidPhoneFormat(form.mobile)
    if (phoneBad || mobileBad) { setPhoneError(phoneBad); setMobileError(mobileBad); return }
    onSave({
      emergency_contact_first_name: form.firstName,
      emergency_contact_middle_name: form.middleName,
      emergency_contact_last_name: form.lastName,
      emergency_contact_phone: form.phone,
      emergency_contact_mobile: form.mobile,
      // Relation is sent BY ID, never the label/slug (verified live — see file
      // header). '' -> null so clearing the picker actually persists (mirrors
      // COUNTRY-1's identical "never send an empty string for a nullable FK").
      emergency_contact_relation_id: form.relationId || null,
    })
    setEditing(false)
  }

  // Composed read-mode name line — mirrors the candidate's own name display
  // (firstname + tussenvoegsel + lastname, blanks filtered out).
  const nameLine = [value.firstName, value.middleName, value.lastName].filter(Boolean).join(' ')
  // Resolve the relation's label LIVE from the already-loaded lookup by id, so
  // it updates instantly after Save (an optimistic merge only carries the new
  // `relationId`, not a fresh nested {id,label} — that needs a server round
  // trip). Falls back to the server's own nested label — never blanked, same
  // tolerance as WorkPermitBlock's legacy-slug fallback.
  const relationLabel = emergencyContactRelations.find(r => r.id === value.relationId)?.label || value.relationLabel

  return (
    <div>
      <GroupHeader title={t('preferences.groupEmergencyContact')}>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button variant="primary" size="sm" iconOnly onClick={save} title={tc('save')}><Save size={13} /></Button>
            <Button variant="secondary" size="sm" iconOnly onClick={cancel} title={tc('cancel')}><X size={13} /></Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" iconOnly onClick={start} title={tc('edit')}><Edit2 size={13} /></Button>
        )}
      </GroupHeader>
      <GroupCard>
        {editing ? (
          <>
            <FieldRow label={t('preferences.emergencyContactFirstName')}>
              <input value={form.firstName} onChange={e => setField('firstName', e.target.value)}
                aria-label={t('preferences.emergencyContactFirstName')} style={inputStyle} />
            </FieldRow>
            <FieldRow label={t('preferences.emergencyContactLastName')}>
              <input value={form.lastName} onChange={e => setField('lastName', e.target.value)}
                aria-label={t('preferences.emergencyContactLastName')} style={inputStyle} />
            </FieldRow>
            <FieldRow label={t('preferences.emergencyContactMiddleName')}>
              <input value={form.middleName} onChange={e => setField('middleName', e.target.value)}
                aria-label={t('preferences.emergencyContactMiddleName')} style={inputStyle} />
            </FieldRow>
          </>
        ) : (
          <FieldRow label={t('preferences.emergencyContactName')}>
            <span style={{ fontSize: 12, color: nameLine ? 'var(--text)' : 'var(--text-muted)' }}>{nameLine || '-'}</span>
          </FieldRow>
        )}
        <FieldRow label={t('preferences.emergencyContactMobile')}
          errorText={mobileError ? t('validation.phoneFormat') : undefined}>
          {editing
            ? <input value={form.mobile} onChange={e => setMobile(e.target.value)} onBlur={blurMobile}
                aria-label={t('preferences.emergencyContactMobile')} aria-invalid={mobileError} style={inputStyle} />
            : <span style={{ fontSize: 12, color: value.mobile ? 'var(--text)' : 'var(--text-muted)' }}>{value.mobile || '-'}</span>}
        </FieldRow>
        <FieldRow label={t('preferences.emergencyContactPhone')}
          errorText={phoneError ? t('validation.phoneFormat') : undefined}>
          {editing
            ? <input value={form.phone} onChange={e => setPhone(e.target.value)} onBlur={blurPhone}
                aria-label={t('preferences.emergencyContactPhone')} aria-invalid={phoneError} style={inputStyle} />
            : <span style={{ fontSize: 12, color: value.phone ? 'var(--text)' : 'var(--text-muted)' }}>{value.phone || '-'}</span>}
        </FieldRow>
        <FieldRow label={t('preferences.emergencyContactRelation')}>
          {editing
            ? <CreatableSelect value={form.relationId || null} onChange={v => setField('relationId', v)} allowCreate={false} clearable
                placeholder={tc('select')} style={inputStyle}
                options={emergencyContactRelations.map(r => ({ value: r.id, label: r.label }))} />
            : <span style={{ fontSize: 12, color: relationLabel ? 'var(--text)' : 'var(--text-muted)' }}>{relationLabel || '-'}</span>}
        </FieldRow>
      </GroupCard>
    </div>
  )
}
