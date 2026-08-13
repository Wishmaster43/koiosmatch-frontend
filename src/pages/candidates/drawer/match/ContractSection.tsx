/**
 * ContractSection — the "Contract" block of the match form: contract type,
 * CAO, start/end date and hours per week. Split out of MatchModal.tsx
 * (audit R1 item 1, MUST-SPLIT) — pure presentational, all state via props from
 * useMatchForm. Contract type + CAO are searchable single-pick combos
 * (Danny 24-07 points 1/5) — allowCreate={false}: both are tenant lookups, never
 * a free-text create.
 *
 * LABEL-LEFT (Danny 13-08): contract type/CAO and start/end date pair up as
 * short fields (P33 `pairRow`); hours per week gets its own full-width row.
 */
import type { TFunction } from 'i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { FormField as F } from './FormField'
import { input, pairRow, pickerMenuWidth } from './styles'

export default function ContractSection({
  t, errors,
  contractType, setContractType, contractTypes,
  cao, setCao, caoOptions,
  startDate, setStartDate, endDate, setEndDate, setEndDateDirty, hours, setHours,
}: {
  t: TFunction; errors: Record<string, boolean>
  contractType: string; setContractType: (v: string) => void; contractTypes: string[]
  cao: string; setCao: (v: string) => void; caoOptions: Array<{ value: string; label: string }>
  startDate: string; setStartDate: (v: string) => void
  // endDate PROPOSES from the picked contract type's default duration (7.1) —
  // setEndDateDirty freezes it the instant the recruiter edits the field by hand.
  endDate: string; setEndDate: (v: string) => void; setEndDateDirty: (v: boolean) => void
  hours: string; setHours: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={pairRow}>
        {/* Contractsoort — searchable tenant lookup (Danny 24-07 point 1), was a
            plain non-searchable SelectMenu; may PROPOSE a tenant-marked default
            (useMatchForm, is_default) into an otherwise empty field.
            A11Y FIX (control round): the shortened 'Soort' label now names the
            trigger for real via aria-labelledby, not just visible text next to it. */}
        <F label={t('placement.contractType')} error={errors.contractType}>
          {(labelId: string) => (
            <CreatableSelect value={contractType || null} onChange={setContractType} allowCreate={false}
              placeholder={t('placement.pickContractType')} menuWidth={pickerMenuWidth}
              aria-labelledby={labelId}
              options={contractTypes.map(c => ({ value: c, label: c }))} />
          )}
        </F>
        {/* CAO — searchable tenant lookup (useCao, Settings → Klanten → CAO), was a
            bare free-text input (Danny 24-07 point 5 finding) — never wired to the
            lookup every other CAO field in the app already uses. */}
        <F label={t('placement.cao')} error={errors.cao}>
          {(labelId: string) => (
            <CreatableSelect value={cao || null} onChange={setCao} allowCreate={false}
              placeholder={t('placement.pickCao')} menuWidth={pickerMenuWidth} options={caoOptions}
              aria-labelledby={labelId} />
          )}
        </F>
      </div>
      <div style={pairRow}>
        {/* A11Y FIX (control round): the two date inputs get their own accessible
            name too — a bare label <div> next to an <input> is not a real association. */}
        <F label={t('placement.startDate')} error={errors.startDate}>
          {(labelId: string) => <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={input} aria-labelledby={labelId} />}
        </F>
        <F label={t('placement.endDate')} error={errors.endDate}>
          {(labelId: string) => <input type="date" value={endDate} onChange={e => { setEndDateDirty(true); setEndDate(e.target.value) }} style={input} aria-labelledby={labelId} />}
        </F>
      </div>
      <F label={t('placement.hoursShort')} error={errors.hours}>
        <input type="number" min={1} max={40} value={hours} onChange={e => setHours(e.target.value)} style={{ ...input, width: 110 }} aria-label={t('placement.hoursPerWeek')} />
      </F>
    </div>
  )
}
