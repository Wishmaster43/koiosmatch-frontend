// Extracted from EditableFieldTable (SIZE-SPLIT-B, zero behaviour change): the
// READ-mode value renderer, dispatched on a FieldRow's declared type.
import { monoStyle } from '@/components/ui/typography'
import Toggle from '@/components/ui/Toggle'
import SoftChip from '@/components/ui/SoftChip'
import SafeHtml from '@/components/ui/SafeHtml'
import CopyIconButton from '@/components/ui/CopyIconButton'
import { composeAddressLine, composeNameLine } from './EditableFieldTable'
import type { FieldRow } from './EditableFieldTable'
import type { ReactNode } from 'react'

type Values = Record<string, unknown>

// Render the READ-mode display for one field. Owns no state of its own.
export function renderFieldValue(f: FieldRow, ctx: {
  saved: Values; formatDate: (v: string) => string; t: (key: string) => string
}) {
  const { saved, formatDate, t } = ctx
  const v = saved[f.key]
  // Canon guard (Danny 05-08, "Geslacht: Man" rendered huge): a caller-supplied
  // renderValue inherits the page's base font unless wrapped — force every custom
  // render into the standard 12px value footprint so no field can drift again.
  if (f.renderValue) return <span style={{ fontSize: 12 }}>{f.renderValue(v)}</span>
  if (f.type === 'checkbox') return <Toggle checked={Boolean(v)} disabled onChange={() => {}} ariaLabel={typeof f.label === 'string' ? f.label : undefined} />
  // Dates render as DD-MM-YYYY in read mode (the edit control already is).
  if (f.type === 'date') return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v ? formatDate(v as string) : '-'}</span>
  // Chips read as soft accent chips (consistent with the Candidate-type chips),
  // not plain comma text — so the read view matches the edit view's chip look.
  if (f.type === 'chips') {
    const arr = (Array.isArray(v) ? v : []).map(String)
    if (arr.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {arr.map(x => {
          const o = (f.chipOptions ?? []).find(op => op.value === x)
          // SoftChip — the ONE chip component (§4, HUISSTIJL-1). Per-value colour when
          // set (e.g. contract forms), else the primary accent (never SoftChip's own
          // neutral-grey fallback, which would drop the "Candidate-type chip" look).
          return <SoftChip key={x} label={o?.label ?? x} color={o?.color ?? 'var(--color-primary)'} round />
        })}
      </div>
    )
  }
  // Selects read as the OPTION LABEL, never the stored slug (Danny 2026-07-13:
  // "Dienst: zorg_detachering" — the lookup label is "Zorg-detachering").
  if (f.type === 'select') {
    const o = (f.options ?? []).find(op => (typeof op === 'object' ? op.value : op) === v)
    const label = o ? (typeof o === 'object' ? o.label : o) : v
    return <span style={{ fontSize: 12, color: label ? 'var(--text)' : 'var(--text-muted)' }}>{(label as ReactNode) || '-'}</span>
  }
  // Single coupling reads as one soft chip (the future multi-value read view swaps
  // this for a wrapped row of chips — CONTACT-MULTI-1 — without touching the schema).
  if (f.type === 'chip-select') {
    const cur = v as string | undefined
    if (!cur) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
    const o = (f.chipOptions ?? []).find(op => op.value === cur)
    // SoftChip — the ONE chip component (§4, HUISSTIJL-1).
    return <SoftChip label={o?.label ?? cur} color={o?.color ?? 'var(--color-primary)'} round />
  }
  // Address composite reads as ONE composed line (only reached in read mode —
  // editing expands this row into its addressFields instead, see renderRows).
  if (f.type === 'address') {
    const line = composeAddressLine(saved)
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: line ? 'var(--text)' : 'var(--text-muted)' }}>{line || '-'}</span>
        <CopyIconButton label={t('common:copyAddress.copy')} copiedLabel={t('common:copyAddress.copied')} value={line || null} />
      </span>
    )
  }
  // Name composite reads as ONE composed line (only reached in read mode —
  // editing expands this row into its nameFields instead, see renderRows). An
  // en dash marks a fully empty name (Danny 05-08) — distinct from the plain
  // hyphen the 'address' composite falls back to above.
  if (f.type === 'name') {
    const line = composeNameLine(saved)
    return <span style={{ fontSize: 12, color: line ? 'var(--text)' : 'var(--text-muted)' }}>{line || '–'}</span>
  }
  // Richtext reads as sanitised HTML (same as notes / profile text).
  if (f.type === 'richtext') {
    return (v as string)
      ? <SafeHtml html={v as string} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
      : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>
  }
  return <span style={{ fontSize: 12, color: 'var(--text)', ...(f.mono ? monoStyle : {}) }}>{f.prefix ? `${f.prefix} ` : ''}{(v as ReactNode) || '-'}</span>
}
