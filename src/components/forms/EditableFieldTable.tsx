/**
 * EditableFieldTable — a key/value table that flips between read and edit mode.
 *
 * Replaces the hand-rolled editable tables in the drawer (preferences, ZZP and
 * the profile fields). Describe the rows once as a schema; the component renders
 * the right control per type and handles the draft + save/cancel cycle. Saved
 * edits stay visible locally (optimistic) until the parent persists them via onSave.
 *
 * Editing can be controlled by the parent (pass `editing` + `onStartEdit` +
 * `onCancel`, e.g. the drawer's global edit mode) or left internal (the default).
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { DateField } from './fields'
import Toggle from '@/components/ui/Toggle'
import { useDateFormat } from '@/lib/datetime'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import type { ChipOption } from '@/components/ui/ChipMultiSelect'
import CreatableSelect from '@/components/ui/CreatableSelect'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
import FieldNotice from '@/components/ui/FieldNotice'
import { CANON_LABEL_WIDTH } from '@/components/drawer/fieldRowCanon'
import SoftChip from '@/components/ui/SoftChip'
import Button from '@/components/ui/Button'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

export interface FieldRow {
  key: string
  label?: ReactNode
  type?: 'text' | 'select' | 'checkbox' | 'date' | 'textarea' | 'chips' | 'richtext' | 'creatable' | 'chip-select' | 'address' | 'name'
  options?: Array<string | { value: string; label?: ReactNode }>
  chipOptions?: ChipOption[]
  prefix?: string
  inputType?: string
  // HTML step for number inputs — '0.01' turns a rate field into a decimal input.
  step?: string
  group?: string
  allowCreate?: boolean
  // Numbers/IDs render in JetBrains Mono (§4) — e.g. rates, cost codes.
  mono?: boolean
  // 'chip-select' empty-state text (e.g. "no locations yet").
  emptyOptionsText?: ReactNode
  // Custom READ-mode rendering for this field's value (edit mode is unaffected) — e.g.
  // an e-mail as a real mailto link with a shortcut icon. Added 28-07 so contact data
  // looks the same on every entity instead of each drawer hand-rolling its own block.
  renderValue?: (value: unknown) => ReactNode
  // 'address' composite (mirrors the candidate ProfileTab pattern, Danny 2026-07-14):
  // read mode shows ONE composed line (street+no+suffix, postcode+city); editing
  // expands to these loose child fields instead. Child keys are read straight off
  // the shared `values` object (street/houseNumber/houseNumberSuffix/postalCode/city).
  addressFields?: FieldRow[]
  // 'name' composite — the sibling of 'address' above (Danny 05-08: "voornaam,
  // tussenvoegsel en achternaam tonen als 1 regel; alleen bij het potloodje zijn
  // het er 3"). Read mode composes ONE line ("Voornaam tussenvoegsel Achternaam",
  // skipping empty parts); editing expands to these loose child fields instead.
  // Same mechanism as 'address': child keys are read straight off the shared
  // `values` object (firstName/middleName/lastName), never a nested 'name' key.
  nameFields?: FieldRow[]
  // Live format check for THIS row while editing (Danny 08-08, points 10/11 —
  // the per-country KvK/BTW check). Returns null when there is nothing to say,
  // a 'warning' the user may save straight through, or an 'error' that refuses
  // the save. Deliberately a caller-supplied function: this table owns no
  // domain rules, it only renders the verdict and gates Save on it.
  validate?: (value: unknown, values: Values) => FieldNotice | null
}

/** One row's live verdict — see FieldRow.validate. */
export interface FieldNotice { message: string; severity: 'error' | 'warning' }

type Values = Record<string, unknown>

// Compose the standard NL one-line address (mirrors candidates/drawer/ProfileTab's
// addressRow): "Straat 12a, 1234 AB Plaats". Fixed key names — every 'address' row
// across the app (candidate profile, customer location) shares this shape.
// eslint-disable-next-line react-refresh/only-export-components -- pure formatter shared by several callers (customerBillingAddress, ZzpAddressCard) alongside this table's own components; not trivial to relocate without touching those unrelated files
export const composeAddressLine = (v: Values): string => {
  const houseNo = [v.houseNumber, v.houseNumberSuffix].filter(Boolean).join('-')
  const line1 = [v.street, houseNo].filter(Boolean).join(' ')
  const line2 = [v.postalCode, v.city].filter(Boolean).join(' ')
  return [line1, line2].filter(s => s && String(s).trim()).join(', ')
}

// Compose the standard "Voornaam tussenvoegsel Achternaam" one-line name — the
// 'name' composite's sibling of composeAddressLine above. Skips empty parts;
// fixed key names (firstName/middleName/lastName), same convention as address.
// eslint-disable-next-line react-refresh/only-export-components -- pure formatter, sibling of composeAddressLine above, same shared-caller reasoning
export const composeNameLine = (v: Values): string =>
  [v.firstName, v.middleName, v.lastName].filter(Boolean).map(String).join(' ')

const compact: CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6,
  // Input surface = the shared --input-bg token (mirrors fieldMetrics.ts), never a
  // hardcoded 'white' — that stayed white in dark mode while --text turned near-white
  // too, making the value unreadable (WCAG contrast audit 2026-08-08).
  border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)',
  boxSizing: 'border-box', outline: 'none',
}
// Row base style, parameterised on `dividers` (CANON-DIVIDER-1, 2026-08-05): the
// candidate ProfileTab's GroupCard never draws a line between rows, so a caller
// that wants that calmer look passes `dividers={false}` — default stays `true`
// (unchanged) so every EXISTING caller (candidate Preferences/ZZP, matches,
// opportunities) keeps its exact current look, byte for byte.
// CANON-BOX (Danny 05-08, DOM-diff kandidaat vs klant): in the calm default the
// CARD carries the padding + a 2px column gap and the rows stay bare (row pitch
// 28px, exactly the candidate ProfileTab). Divider mode keeps the original
// full-bleed rows that own their padding/background.
const rowStyle = (dividers: boolean): CSSProperties => dividers
  ? { display: 'flex', alignItems: 'center', gap: 12, minHeight: 26, padding: '7px 12px', background: 'var(--surface)' }
  : { display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }

// Canon pencil (05-08): the candidate ProfileTab's bordered 26×26 icon button —
// one pencil look on every card header, never the old borderless glyph.
function EditPencil({ onClick, title, style }: { onClick: () => void; title: string; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- canon 26×26 pencil, deliberately matched to this table's 26px row minHeight (Button's iconOnly sm is 28px and would overflow the row)
    <button onClick={onClick} title={title} style={{ width: 26, height: 26, display: 'flex',
      alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer',
      background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', ...style }}>
      <Edit2 size={13} />
    </button>
  )
}

interface EditableFieldTableProps {
  title?: ReactNode
  fields: FieldRow[]
  value?: Values
  onSave?: (values: Values) => void
  labelWidth?: number
  editButton?: 'header' | 'inside'
  editing?: boolean
  onStartEdit?: () => void
  onCancel?: () => void
  // CANON-DIVIDER-1 (2026-08-05): opt into the candidate ProfileTab's calmer card
  // look — no line between rows, an 11px label — instead of this table's original
  // dense, line-per-row look. Both default to the ORIGINAL values so every existing
  // caller is pixel-identical unless it explicitly opts in.
  dividers?: boolean
  labelFontSize?: number
}

// Normalise FieldRow options for the searchable picker: it matches on text, so a
// ReactNode label (used by a few icon rows) falls back to the raw value.
const selectOptions = (options: FieldRow['options']): Array<{ value: string; label: string }> =>
  (options ?? []).map(o => (typeof o === 'string'
    ? { value: o, label: o }
    : { value: o.value, label: typeof o.label === 'string' ? o.label : o.value }))

/**
 * Content comparison, deliberately NOT reference equality: most callers build their
 * `value` object inline, so a fresh identity arrives on every render — comparing by
 * reference would set state on every render and spin forever. Arrays are compared
 * element-wise so a re-mapped chips list does not read as a change either.
 */
function sameValues(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a); const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => {
    const x = a[k]; const y = b[k]
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => Object.is(v, y[i]))
    return Object.is(x, y)
  })
}

export default function EditableFieldTable({
  // CANON default (fieldRowCanon, Danny 05-08): was 130, drifted from the
  // candidate ProfileTab's 120 — callers that genuinely need more document why.
  title, fields, value = {}, onSave, labelWidth = CANON_LABEL_WIDTH, editButton = 'header',
  editing: editingProp, onStartEdit, onCancel,
  // CANON-DEFAULT-FLIP (Danny 05-08, "we hebben gezegd geen streepjes toch?"):
  // the calm candidate canon IS the default now — no dividers, 11px labels —
  // so no tab can ever forget to opt in again. True list rows that want a
  // separator opt in explicitly with dividers={true} + a written reason.
  dividers = false, labelFontSize = 11,
}: EditableFieldTableProps) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  const controlled = editingProp !== undefined
  const [editingState, setEditingState] = useState(false)
  const editing = controlled ? editingProp : editingState

  // `saved` holds the currently shown values; `form` is the in-progress draft.
  // The draft is seeded from `saved` the moment we enter edit mode — done by
  // adjusting state during render (React's recommended pattern, no extra effect).
  const [saved, setSaved] = useState<Values>(value)
  const [form, setForm] = useState<Values>(value)
  // Per-field expand toggle for richtext editors (key → expanded).
  const [richExpanded, setRichExpanded] = useState<Record<string, boolean>>({})
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing && !wasEditing) { setForm(saved); setWasEditing(true) }
  else if (!editing && wasEditing) setWasEditing(false)
  // The read view follows the SOURCE OF TRUTH, not the last draft. Until now `saved` was
  // written only by save(), so a parent that stored something different from what was
  // typed left this table showing the typed value forever — measured 28-07 on the
  // contact drawer: declining "replace the primary contact?" saves isPrimary FALSE while
  // the toggle kept reading ON, and only a remount healed it. Re-syncing while EDITING
  // would throw away an in-progress draft, so it is deliberately read-mode only.
  const [lastValue, setLastValue] = useState<Values>(value)
  if (!sameValues(value, lastValue)) { setLastValue(value); if (!editing) setSaved(value) }
  const setF = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  // Live per-row verdicts over the CURRENT draft. Only computed while EDITING —
  // `form` is a draft that is re-seeded on entering edit mode, so judging it in read
  // mode would judge stale input. A row without `validate` never produces one, so
  // every existing caller is byte-for-byte unchanged.
  const noticeFor = (f: FieldRow): FieldNotice | null => (editing && f.validate ? f.validate(form[f.key], form) : null)
  // Save is refused only by a real 'error' — a 'warning' is a hint the user may
  // save straight through (§3: never hold back data that can be valid).
  const hasBlockingError = fields.some(f => noticeFor(f)?.severity === 'error')

  const startEdit = () => (controlled ? onStartEdit?.() : setEditingState(true))
  const cancel    = () => { setForm(saved); if (controlled) onCancel?.(); else setEditingState(false) }
  const save      = () => { if (hasBlockingError) return; setSaved(form); onSave?.(form); if (!controlled) setEditingState(false) }
  // In-place save (diskette) + cancel (✕), same spot as the pencil. House Button
  // (HUISSTIJL-1, BTN-5) — an icon save button is Button size="sm" iconOnly,
  // never a local iconBtn style constant re-painting the same identity.
  const editControls = () => (
    <div style={{ display: 'flex', gap: 4 }}>
      {/* Disabled (never hidden) while a row reports a blocking format error, so
          the reason stays readable on screen. */}
      <Button variant="primary" size="sm" iconOnly onClick={save} disabled={hasBlockingError} title={t('save')}>
        <Save size={13} />
      </Button>
      <Button variant="secondary" size="sm" iconOnly onClick={cancel} title={t('cancel')}>
        <X size={13} />
      </Button>
    </div>
  )

  const renderControl = (f: FieldRow) => {
    const v = form[f.key]
    // A boolean field is a TOGGLE, never a tick box (Danny: "GEEN VINKJES MAAR
    // TOGGLES!!", repeated 28-07 for the primary-contact flag). One shared switch, so
    // every boolean in every drawer reads the same.
    if (f.type === 'checkbox') return <Toggle checked={Boolean(v)} onChange={val => setF(f.key, val)} ariaLabel={typeof f.label === 'string' ? f.label : undefined} />
    // Every drawer picker is SEARCHABLE (Danny 28-07: "status/land/provincie is geen
    // zoekbare dropdown"). This one line covers status, land, provincie, branche and
    // vestiging on every entity that uses this table — a native <select> forces you to
    // scroll a 200-item country list. allowCreate stays off: these are tenant lookups,
    // adding a value belongs in Settings, not in a record's edit row.
    if (f.type === 'select')   return <CreatableSelect value={(v as string) ?? ''} onChange={val => setF(f.key, val)} options={selectOptions(f.options)} placeholder={t('select')} allowCreate={false} style={compact} />
    if (f.type === 'creatable') {
      // Lookup combobox that can also add a free-text value (tenant `allowCreate`).
      const opts = (f.options ?? []).map(o => (typeof o === 'string' ? o : { value: o.value, label: String(o.label ?? o.value) }))
      return <CreatableSelect value={(v as string) ?? ''} onChange={val => setF(f.key, val)} options={opts} placeholder={t('select')} allowCreate={f.allowCreate !== false} style={compact} />
    }
    if (f.type === 'date')     return <DateField value={v as string | undefined} onChange={val => setF(f.key, val)} style={compact} />
    if (f.type === 'textarea') return <textarea value={(v as string) ?? ''} onChange={e => setF(f.key, e.target.value)} rows={3} style={{ ...compact, resize: 'vertical' }} />
    if (f.type === 'chips') {
      const arr = (Array.isArray(v) ? v : []).map(String)
      return <ChipMultiSelect options={f.chipOptions ?? []} selected={arr}
        onToggle={val => setF(f.key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])} />
    }
    // CONTACT-MULTI-1: a single-value coupling rendered as toggle chips (not a
    // plain <select>) so the field is visually ready for multi-value later — the
    // backend only supports one link today, so picking a chip REPLACES the value
    // (clicking the active chip clears it) rather than adding to a set.
    if (f.type === 'chip-select') {
      const cur = v as string | undefined
      const opts = f.chipOptions ?? []
      if (opts.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.emptyOptionsText ?? '—'}</span>
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {opts.map(o => {
            const active = cur === o.value
            const col = o.color ?? 'var(--color-primary)'
            return (
              <button key={o.value} type="button" onClick={() => setF(f.key, active ? '' : o.value)}
                // Interactive toggle chip — stays a real <button> (SoftChip has no
                // onClick), but the tint now uses the house tintBg/tintBorder formula
                // instead of hex-concat (§4, HUISSTIJL-1).
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- chip toggle, not a Button (SoftChip has no onClick and Button has no chip/pill identity)
                style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.12s',
                  ...(active ? { background: tintBg(col, true), color: chipInk(col), border: tintBorder(col, true) } : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }) }}>
                {o.label}
              </button>
            )
          })}
        </div>
      )
    }
    if (f.type === 'richtext') {
      return <RichTextEditor value={(v as string) ?? ''} onChange={val => setF(f.key, val)}
        expanded={!!richExpanded[f.key]} onToggleExpand={() => setRichExpanded(p => ({ ...p, [f.key]: !p[f.key] }))} />
    }
    // Numbers/IDs render in mono (§4) — rates, cost codes, etc.
    return <input value={(v as string) ?? ''} type={f.inputType} step={f.step} onChange={e => setF(f.key, e.target.value)}
      style={f.mono ? { ...compact, fontFamily: 'JetBrains Mono, monospace' } : compact} />
  }

  const renderValue = (f: FieldRow) => {
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
      return <span style={{ fontSize: 12, color: line ? 'var(--text)' : 'var(--text-muted)' }}>{line || '-'}</span>
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
    return <span style={{ fontSize: 12, color: 'var(--text)', ...(f.mono ? { fontFamily: 'JetBrains Mono, monospace' } : {}) }}>{f.prefix ? `${f.prefix} ` : ''}{(v as ReactNode) || '-'}</span>
  }

  // One row — full-width for textarea/chips/richtext (they need the width), label-left otherwise.
  // CANON-DIVIDER-1: the line between rows (and the row label's font size) are the two
  // knobs the candidate ProfileTab canon changes; both fall back to this table's
  // original look when the caller doesn't pass them.
  // CHIP-INLINE-1 (Danny 05-08 "niet eronder maar ernaast"): chips READ as a normal
  // label-left row (they wrap in the value area); only while EDITING do they take the
  // full width — the option grid genuinely needs it (mirrors textarea/richtext).
  const renderRow = (f: FieldRow, last: boolean) => (f.type === 'textarea' || (f.type === 'chips' && editing) || f.type === 'richtext') ? (
    <div key={f.key} style={dividers
      ? { padding: '7px 12px', background: 'var(--surface)', borderBottom: !last ? '1px solid var(--border)' : 'none' }
      : { padding: '4px 0' }}>
      <span style={{ fontSize: labelFontSize, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</span>
      {editing ? renderControl(f) : renderValue(f)}
      {editing && <FieldNotice text={noticeFor(f)?.message} severity={noticeFor(f)?.severity} />}
    </div>
  ) : (
    <div key={f.key} style={dividers
      ? { ...rowStyle(dividers), borderBottom: !last ? '1px solid var(--border)' : 'none' }
      : rowStyle(dividers)}>
      {/* Canon label span — the same flex/gap-5 anatomy as the candidate's FieldRow. */}
      <span style={{ fontSize: labelFontSize, color: 'var(--text-muted)', width: labelWidth, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>{f.label}</span>
      {/* Canon value wrapper (flex 1 / minWidth 0); the row's own minHeight centres it.
          A live format verdict renders directly under the control, never over it. */}
      {editing
        ? <div style={{ flex: 1, minWidth: 0 }}>{renderControl(f)}<FieldNotice text={noticeFor(f)?.message} severity={noticeFor(f)?.severity} /></div>
        : <div style={{ flex: 1, minWidth: 0 }}>{renderValue(f)}</div>}
    </div>
  )

  // Render one list of fields as rows — an 'address' row expands into its loose
  // addressFields while editing (so street/no/postcode/city become editable), and
  // collapses back to its single composed-line row once editing stops. The 'name'
  // composite mirrors the exact same flatten-on-edit mechanism via nameFields.
  // Border placement (`last`) follows the FLATTENED position, not the declared field list.
  const renderFieldRows = (list: FieldRow[]) => {
    const flat = list.flatMap(f => (f.type === 'address' && editing) ? (f.addressFields ?? [])
      : (f.type === 'name' && editing) ? (f.nameFields ?? [])
      : [f])
    return flat.map((f, i) => renderRow(f, i === flat.length - 1))
  }

  // Optional grouping — fields carrying a `group` render as separate titled cards.
  const hasGroups = fields.some(f => f.group)
  const groups = hasGroups
    ? fields.reduce<{ group: string; fields: FieldRow[] }[]>((acc, f) => {
        const prev = acc[acc.length - 1]
        if (prev && prev.group === (f.group ?? '')) prev.fields.push(f)
        else acc.push({ group: f.group ?? '', fields: [f] })
        return acc
      }, [])
    : null
  // CANON-BOX: calm cards pad once (6/12) and stack rows with gap 2 — the 28px row
  // pitch of the candidate canon. Divider cards stay bare shells around full-bleed rows.
  const cardStyle: CSSProperties = dividers
    ? { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }
    : { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)',
        padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }
  const groupTitleStyle: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 6 }

  // M7 (DRILL-DOWN-CONSISTENCY, 08-08): the top header bar only renders when there is
  // a real title for it to show — a titleless header on a GROUPED table produced an
  // empty grey bar sitting above the groups' own titled cards (2 headings + 1
  // floating pencil + nothing to read, on the match Contract & financieel card). A
  // titleless UNGROUPED table (e.g. DepartmentDetail's `title=""`, which intentionally
  // skips a duplicate sub-tab title) is untouched — there the bar is still the only
  // place for the pencil, so it keeps rendering exactly as before.
  const showTopHeader = editButton === 'header' && (Boolean(title) || !hasGroups)
  // Grouped + titleless: the shared pencil (ONE edit cycle governs every group in the
  // table, unchanged) has no header of its own left to sit in — it moves onto the
  // FIRST group's own title row instead, the same "pencil beside a title" spot every
  // other card in the app uses, rather than being dropped.
  const groupHeaderPencil = editButton === 'header' && !title && hasGroups

  return (
    <div>
      {showTopHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{title}</span>
          {editing ? editControls() : <EditPencil onClick={startEdit} title={t('edit')} />}
        </div>
      )}

      {hasGroups && groups ? (
        // Canon card pitch: pure gap-10 stacking, no extra margins (candidate ProfileTab).
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: dividers ? 12 : 0 }}>
          {groups.map((g, i) => (
            <div key={g.group}>
              {g.group && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ ...groupTitleStyle, marginBottom: 0 }}>{g.group}</span>
                  {groupHeaderPencil && i === 0 && (editing ? editControls() : <EditPencil onClick={startEdit} title={t('edit')} />)}
                </div>
              )}
              <div style={cardStyle}>{renderFieldRows(g.fields)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...cardStyle, marginBottom: dividers ? 12 : 0, position: 'relative' }}>
          {editButton === 'inside' && (
            <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
              {editing ? editControls() : <EditPencil onClick={startEdit} title={t('edit')} />}
            </div>
          )}
          {renderFieldRows(fields)}
        </div>
      )}
    </div>
  )
}
