/**
 * ContractSection — the "Contract" block of the placement form: contract type,
 * CAO, start/end date and hours per week. Split out of MatchPlacementModal.tsx
 * (audit R1 item 1, MUST-SPLIT) — pure presentational, all state via props from
 * useMatchPlacementForm.
 */
import type { TFunction } from 'i18next'
import SelectMenu from '@/components/ui/SelectMenu'
import { FormField as F } from './FormField'
import { input, row2, row3 } from './styles'

export default function ContractSection({
  t, errors,
  contractType, setContractType, contractTypes,
  cao, setCao,
  startDate, setStartDate, endDate, setEndDate, setEndDateDirty, hours, setHours,
}: {
  t: TFunction; errors: Record<string, boolean>
  contractType: string; setContractType: (v: string) => void; contractTypes: string[]
  cao: string; setCao: (v: string) => void
  startDate: string; setStartDate: (v: string) => void
  // endDate PROPOSES from the picked contract type's default duration (7.1) —
  // setEndDateDirty freezes it the instant the recruiter edits the field by hand.
  endDate: string; setEndDate: (v: string) => void; setEndDateDirty: (v: boolean) => void
  hours: string; setHours: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row2}>
        <F label={t('placement.contractType')} error={errors.contractType}>
          <SelectMenu value={contractType || null} onChange={setContractType} placeholder={t('placement.pickContractType')}
            options={contractTypes.map(c => ({ value: c, label: c }))} />
        </F>
        <F label={t('placement.cao')} error={errors.cao}><input value={cao} onChange={e => setCao(e.target.value)} style={input} placeholder="VVT" /></F>
      </div>
      {/* S24c: hours joins the date row (compact third column) — one row less to scroll. */}
      <div style={row3}>
        <F label={t('placement.startDate')} error={errors.startDate}><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={input} /></F>
        <F label={t('placement.endDate')} error={errors.endDate}><input type="date" value={endDate} onChange={e => { setEndDateDirty(true); setEndDate(e.target.value) }} style={input} /></F>
        <F label={t('placement.hoursShort')} error={errors.hours}><input type="number" min={1} max={40} value={hours} onChange={e => setHours(e.target.value)} style={input} aria-label={t('placement.hoursPerWeek')} /></F>
      </div>
    </div>
  )
}
