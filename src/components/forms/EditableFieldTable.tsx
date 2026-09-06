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
import { useDateFormat } from '@/lib/datetime'
import type { ChipOption } from '@/components/ui/ChipMultiSelect'
import FieldNotice from '@/components/ui/FieldNotice'
import { CANON_LABEL_WIDTH } from '@/components/drawer/fieldRowCanon'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import { renderFieldControl } from './editableFieldControls'
import { renderFieldValue } from './editableFieldDisplay'

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
  // VAC-CLEAR-1 passthrough for OPTIONAL selects (MATCH-EDIT-1, 22-08): renders
  // CreatableSelect's own clear-cross instead of forcing callers to inject an
  // artificial "none" option (which also leaked its label into read mode).
  clearable?: boolean
  // Numbers/IDs render in JetBrains Mono (§4) — e.g. rates, cost codes.
  mono?: boolean
  // 'chip-select' empty-state text (e.g. "no locations yet").
  emptyOptionsText?: ReactNode
  // Custom READ-mode rendering for this field's value (edit mode is unaffected) — e.g
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
  // Read-only field that never enters edit mode — always renders its read-mode value,
  // skips the edit control entirely. Used for derived/calculated fields that should
  // never be user-editable but belong in the same table structure (e.g. blacklist reason
  // when the status is flagged as blacklist).
  readOnly?: boolean
}

/** One row's live verdict — see FieldRow.validate. */
export interface FieldNotice { message: string; severity: 'error' | 'warning' }

type Values = Record<string, unknown>

// Compose the standard NL one-line address (mirrors candidates/drawer/ProfileTab's
// addressRow): "Straat 12a, 1234 AB Plaats". Fixed key names — every 'address' row
// across the app (candidate profile, customer location) shares this shape.
// I18N-1: an optional `addressLine2` (unit/building) sits between the street line and
// the postcode line — the same order the backend's Address::oneLine() uses.
// eslint-disable-next-line react-refresh/only-export-components -- pure formatter shared by several callers (customerBillingAddress, ZzpAddressCard) alongside this table's own components; not trivial to relocate without touching those unrelated files
export const composeAddressLine = (v: Values): string => {
  const houseNo = [v.houseNumber, v.houseNumberSuffix].filter(Boolean).join('-')
  const line1 = [v.street, houseNo].filter(Boolean).join(' ')
  const line2 = [v.postalCode, v.city].filter(Boolean).join(' ')
  return [line1, v.addressLine2, line2].filter(s => s && String(s).trim()).join(', ')
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
      <Button variant="primary" size="sm" iconOnly onClick={save} disabled={hasBlockingError} title={t('save')} aria-label={t('save')}>
        <Save size={13} />
      </Button>
      <Button variant="secondary" size="sm" iconOnly onClick={cancel} title={t('cancel')} aria-label={t('cancel')}>
        <X size={13} />
      </Button>
    </div>
  )

  // Render the EDIT-mode control for one field — dispatch lives in editableFieldControls.tsx.
  const renderControl = (f: FieldRow) => renderFieldControl(f, { form, setF, compact, t, richExpanded, setRichExpanded })

  // Render the READ-mode display for one field — dispatch lives in editableFieldDisplay.tsx.
  const renderValue = (f: FieldRow) => renderFieldValue(f, { saved, formatDate, t })

  // One row — full-width for textarea/chips/richtext (they need the width), label-left otherwise.
  // CANON-DIVIDER-1: the line between rows (and the row label's font size) are the two
  // knobs the candidate ProfileTab canon changes; both fall back to this table's
  // original look when the caller doesn't pass them.
  // CHIP-INLINE-1 (Danny 05-08 "niet eronder maar ernaast"): chips READ as a normal
  // label-left row (they wrap in the value area); only while EDITING do they take the
  // full width — the option grid genuinely needs it (mirrors textarea/richtext).
  // readOnly fields always render their value, never the edit control (used for derived fields).
  const renderRow = (f: FieldRow, last: boolean) => (f.type === 'textarea' || (f.type === 'chips' && editing) || f.type === 'richtext') ? (
    <div key={f.key} style={dividers
      ? { padding: '7px 12px', background: 'var(--surface)', borderBottom: !last ? '1px solid var(--border)' : 'none' }
      : { padding: '4px 0' }}>
      <span style={{ fontSize: labelFontSize, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</span>
      {editing && !f.readOnly ? renderControl(f) : renderValue(f)}
      {editing && !f.readOnly && <FieldNotice text={noticeFor(f)?.message} severity={noticeFor(f)?.severity} />}
    </div>
  ) : (
    <div key={f.key} style={dividers
      ? { ...rowStyle(dividers), borderBottom: !last ? '1px solid var(--border)' : 'none' }
      : rowStyle(dividers)}>
      {/* Canon label span — the same flex/gap-5 anatomy as the candidate's FieldRow. */}
      <span style={{ fontSize: labelFontSize, color: 'var(--text-muted)', width: labelWidth, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>{f.label}</span>
      {/* Canon value wrapper (flex 1 / minWidth 0); the row's own minHeight centres it.
          A live format verdict renders directly under the control, never over it. readOnly
          fields skip the control and always show their value. */}
      {editing && !f.readOnly
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

  // M7 (DRILL-DOWN-CONSISTENCY, 08-08): the top header bar only renders when there is
  // a real title for it to show — a titleless header on a GROUPED table produced an
  // empty grey bar sitting above the groups' own titled cards (2 headings + 1
  // floating pencil + nothing to read, on the match Contract & financieel card). A
  // titleless UNGROUPED table (e.g. DepartmentDetail's `title=""`, which intentionally
  // skips a duplicate sub-tab title) is untouched — there the bar is still the only
  // place for the pencil, so it keeps rendering exactly as before.
  // §3 no fake affordances (MATCH-EDIT-1 Opus round, 22-08): without an onSave
  // (and outside controlled editing) the pencil opened an edit mode whose save
  // silently did nothing — a table with no persistence path is read-only, so it
  // shows no pencil at all. Callers already pass `onSave={can ? fn : undefined}`.
  const editable = Boolean(onSave) || controlled
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
          <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{title}</GroupLabel>
          {editable && (editing ? editControls() : <EditPencil onClick={startEdit} title={t('edit')} />)}
        </div>
      )}

      {hasGroups && groups ? (
        // Canon card pitch: pure gap-10 stacking, no extra margins (candidate ProfileTab).
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: dividers ? 12 : 0 }}>
          {groups.map((g, i) => (
            <div key={g.group}>
              {g.group && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{g.group}</GroupLabel>
                  {editable && groupHeaderPencil && i === 0 && (editing ? editControls() : <EditPencil onClick={startEdit} title={t('edit')} />)}
                </div>
              )}
              <div style={cardStyle}>{renderFieldRows(g.fields)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...cardStyle, marginBottom: dividers ? 12 : 0, position: 'relative' }}>
          {editable && editButton === 'inside' && (
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
