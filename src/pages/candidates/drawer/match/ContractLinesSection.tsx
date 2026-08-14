/**
 * ContractLinesSection — the CONTRACTREGELS editor (MATCH-SOORT-1, §1 of the
 * changelog): only rendered when the picked Contractvorm carries
 * `has_contract_lines`. One row per {functie, tarief}, added/removed via the
 * shared DrawerAddButton/row-anatomy (CLAUDE.md §3A — never a bare "+" text
 * link). Array ORDER is the sort order the backend persists (sort_order),
 * so add appends and remove simply splices — no separate reorder UI needed
 * for this small a list. The parent (useMatchForm) sends this array as a
 * FULL replacing set on every save; an empty array is always legal.
 */
import { useId } from 'react'
import { Trash2 } from 'lucide-react'
import type { TFunction } from 'i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import { lbl, input, pickerMenuWidth } from './styles'
import type { MatchContractLine } from '@/types/match'

// Visually-hidden but screen-reader-visible label — every row's function/rate
// pair needs its OWN accessible name (a11y §6), not a shared one.
const srOnly: React.CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }

interface Props {
  t: TFunction
  lines: MatchContractLine[]
  setLines: (v: MatchContractLine[]) => void
  functions: string[]
}

export default function ContractLinesSection({ t, lines, setLines, functions }: Props) {
  // Append one empty row — array position IS the sort order sent on save.
  const addLine = () => setLines([...lines, { functionTitle: '', rate: '' }])
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx))
  const updateLine = (idx: number, patch: Partial<MatchContractLine>) =>
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={lbl}>{t('placement.contractLines.title')}</span>
        <DrawerAddButton onClick={addLine} label={t('placement.contractLines.add')} short />
      </div>
      {lines.length === 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('placement.contractLines.empty')}</div>
      )}
      {lines.map((line, idx) => <ContractLineRow key={idx} idx={idx} line={line} functions={functions} t={t}
        onChange={patch => updateLine(idx, patch)} onRemove={() => removeLine(idx)} />)}
    </div>
  )
}

// One row — own hook instance for useId, so each row's function/rate pickers
// get their own stable, unique accessible names.
function ContractLineRow({ idx, line, functions, t, onChange, onRemove }: {
  idx: number; line: MatchContractLine; functions: string[]; t: TFunction
  onChange: (patch: Partial<MatchContractLine>) => void; onRemove: () => void
}) {
  const funcLabelId = useId()
  const rateLabelId = useId()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span id={funcLabelId} style={srOnly}>{t('placement.pickFunction')} {idx + 1}</span>
      <span id={rateLabelId} style={srOnly}>{t('placement.contractLines.rate')} {idx + 1}</span>
      <div style={{ flex: 2, minWidth: 0 }}>
        <CreatableSelect value={line.functionTitle || null} onChange={v => onChange({ functionTitle: v })}
          allowCreate={false} placeholder={t('placement.pickFunction')} menuWidth={pickerMenuWidth}
          aria-labelledby={funcLabelId}
          options={functions.map(f => ({ value: f, label: f }))} />
      </div>
      <input type="number" value={line.rate} onChange={e => onChange({ rate: e.target.value })}
        placeholder={t('placement.contractLines.rate')} aria-labelledby={rateLabelId}
        style={{ ...input, width: 110, fontFamily: 'JetBrains Mono, monospace' }} />
      <button type="button" onClick={onRemove} title={t('common:remove')} aria-label={t('common:remove')}
        style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}
