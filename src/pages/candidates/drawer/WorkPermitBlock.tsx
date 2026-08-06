import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DatePicker from 'react-datepicker'
import { useDateFormat } from '@/lib/datetime'
import { FieldRow, EditControls, GroupCard, GroupHeader, inputStyle } from './profileFieldShared'
import { useIsNonEuNationality } from './useIsNonEuNationality'
import type { Candidate } from '@/types/candidate'

// The fields this card owns — mirrors ProfilePersonalTab's per-card split (own
// pencil, own draft/error state, never blocking another card's in-progress edit).
type WPKey = 'workPermitType' | 'workPermitValidUntil'
type WPForm = Record<WPKey, string>

/**
 * WorkPermitBlock — KAND-WERKVERGUNNING-2: work-permit fields, shown ONLY for a
 * non-EU/EEA candidate (useIsNonEuNationality, resolved from the nationality
 * lookup's `is_eu` flag — never a hardcoded nationality list). Two plain backend
 * columns (candidates.work_permit_type / work_permit_valid_until — see the
 * candidates migration, CandidateProfileRequest and WorkPermitGuard): no
 * controlled vocabulary on the backend, so `work_permit_type` is a free-text
 * field, not a lookup dropdown. One more stacked card in ProfileTab, same
 * pencil→save/cancel convention as Personal/Address/Contact.
 *
 * DATA-PLUMBING NOTE (handover): mapCandidate.ts does not map
 * work_permit_type/work_permit_valid_until onto the typed Candidate model yet,
 * and candidatesShared.ts's buildCandidatePatch does not forward
 * workPermitType/workPermitValidUntil onto the PATCH body either — both are
 * outside this change's owned files (mapCandidate.ts / candidatesShared.ts /
 * types/candidate.ts). Until those three small additions land (exact snippets in
 * the handover), this card LOCALLY reflects an edit (CandidateDrawer's
 * `mergedC` spread) but the PATCH silently carries no work-permit fields, so a
 * reload reverts it — flagged loudly rather than shipped silently. Reads the raw
 * record defensively (mirrors the identical pattern in BackgroundTab.tsx's
 * `references` field) so this card starts showing real data the moment the
 * mapper change lands, with no further edit here.
 */
export default function WorkPermitBlock({ c, onSave, autoEditSignal }: {
  c: Candidate; onSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number
}) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  const isNonEu = useIsNonEuNationality(c.nationality)

  // See the DATA-PLUMBING NOTE above — read both the (future) typed camelCase
  // keys and today's raw snake_case API keys, whichever is present.
  const raw = c as unknown as {
    workPermitType?: string | null; workPermitValidUntil?: string | null
    work_permit_type?: string | null; work_permit_valid_until?: string | null
  }
  const currentType = raw.workPermitType ?? raw.work_permit_type ?? ''
  const currentValidUntil = raw.workPermitValidUntil ?? raw.work_permit_valid_until ?? ''

  const emptyForm = (): WPForm => ({ workPermitType: currentType, workPermitValidUntil: currentValidUntil })
  const [editing, setEditing] = useState(false)
  // Open edit mode when the parent bumps the signal (mirrors ProfilePersonalTab —
  // e.g. right after Lead→Kandidaat convert, every card opens together).
  const [prevAutoEdit, setPrevAutoEdit] = useState(autoEditSignal ?? 0)
  if ((autoEditSignal ?? 0) !== prevAutoEdit) { setPrevAutoEdit(autoEditSignal ?? 0); setEditing(true) }
  const [form, setForm] = useState<WPForm>(emptyForm)
  const setF = (k: WPKey, v: string) => setForm(p => ({ ...p, [k]: v }))

  // Both fields are optional (no tenant-required flag exists for these — the
  // backend's own guard, WorkPermitGuard, only fires at match-creation time).
  const save = () => { onSave?.(form); setEditing(false) }
  const cancel = () => { setForm(emptyForm()); setEditing(false) }

  // Not an EU/EEA candidate → no work-permit fields to show (calm by default,
  // §3B: the block appears only when the tenant's own lookup flags it relevant).
  if (!isNonEu) return null

  const renderInput = (key: WPKey) => {
    if (key === 'workPermitValidUntil') return (
      <DatePicker
        selected={(() => { try { const d = form.workPermitValidUntil ? new Date(form.workPermitValidUntil) : null; return d && !isNaN(d.getTime()) ? d : null } catch { return null } })()}
        onChange={(d: Date | null) => setF('workPermitValidUntil', d ? d.toISOString().slice(0, 10) : '')}
        dateFormat="dd-MM-yyyy"
        showMonthDropdown showYearDropdown dropdownMode="select"
        placeholderText={t('profile.selectDate')}
        portalId="datepicker-portal"
        popperPlacement="bottom-start"
        customInput={<input style={inputStyle} />}
      />
    )
    return <input value={form.workPermitType} onChange={e => setF('workPermitType', e.target.value)} style={inputStyle} />
  }

  const renderValue = (key: WPKey) => {
    if (key === 'workPermitValidUntil') {
      const v = currentValidUntil
      return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v ? formatDate(v) : '-'}</span>
    }
    return <span style={{ fontSize: 12, color: currentType ? 'var(--text)' : 'var(--text-muted)' }}>{currentType || '-'}</span>
  }

  const field = (key: WPKey, label: string) => (
    <FieldRow key={key} label={label}>
      {editing ? renderInput(key) : renderValue(key)}
    </FieldRow>
  )

  // KAND-WERKVERGUNNING-2: these three keys are NOT in the locale files yet (out
  // of scope here — see the handover, which reports them for all five locales).
  // `defaultValue` mirrors BackgroundTab.tsx's identical KAND-REFERENTIES-1
  // pattern: real Dutch text renders immediately, the manager's key addition is
  // then a no-op swap-in rather than a blocker.
  return (
    <div>
      <GroupHeader title={t('profile.groupWorkPermit', { defaultValue: 'Werkvergunning' })}>
        <EditControls editing={editing} onSave={save} onCancel={cancel} onStart={() => setEditing(true)} />
      </GroupHeader>
      <GroupCard>
        {field('workPermitType', t('profile.workPermitType', { defaultValue: 'Type werkvergunning' }))}
        {field('workPermitValidUntil', t('profile.workPermitValidUntil', { defaultValue: 'Geldig tot' }))}
      </GroupCard>
    </div>
  )
}
