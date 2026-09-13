/**
 * SettingsControls — small shared UI controls reused across settings sections:
 * a colour picker (swatch + popup), a colour badge, and a drag-to-reorder list.
 */
import { useRef, useState } from 'react'
import type { RefObject, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GripVertical, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COLOR_PRESETS } from '@/lib/colorPresets'
import Toggle from '@/components/ui/Toggle'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useDropdownPlacement } from '@/lib/useDropdownPlacement'
import { tintBg, tintBorder } from '@/lib/tint'

// ColorPaletteGrid — the curated soft-palette swatch grid (LOOKUP-ONE-ELEMENT-1):
// ONE copy shared by ColorPickerPopup below and by LookupValueMark's popover, so
// picking a colour looks and behaves identically everywhere it is offered.
interface ColorPaletteGridProps { value?: string; onPick: (c: string) => void }
export function ColorPaletteGrid({ value, onPick }: ColorPaletteGridProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {COLOR_PRESETS.map(c => (
        <button key={c} type="button" aria-label={c} onClick={() => onPick(c)}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- palette swatch cell (its own fill IS the colour value), not a Button
          style={{ width: 26, height: 26, borderRadius: 6, background: c, border: c === value ? '2px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }} />
      ))}
    </div>
  )
}

// The curated-palette popover anchored under ColorSwatch; outside click closes it,
// and Escape closes ONLY the popover: useFocusTrap handles the key at this element
// (stopPropagation), so a hosting dialog's own trap never fires for it.
// SETTINGS-INCON-B2 F1 (Opus review, 13-09): portalled into document.body so it
// escapes a hosting modal's `overflow: hidden`/`overflow: auto` panel — the same
// clipping FloatingPanel's own body wrapper would otherwise cause, mirrors the
// house recipe in CreatableSelect.tsx (createPortal + fixed coords off the
// trigger's own measured rect via the shared useDropdownPlacement).
interface ColorPickerPopupProps {
  triggerRef: RefObject<HTMLElement | null>
  color?: string
  onChange: (c: string) => void
  onClose: () => void
}
function ColorPickerPopup({ triggerRef, color, onChange, onClose }: ColorPickerPopupProps) {
  const [hex, setHex] = useState<string | undefined>(color)
  const ref = useFocusTrap(onClose)
  // Positioned off the TRIGGER's rect (not the popup's own, portalled-out position).
  const { rect } = useDropdownPlacement(triggerRef, true)
  // Close the popup on any outside mousedown — both the trigger AND the portalled
  // panel itself count as "inside" (shared useClickOutside, CLICK-OUTSIDE-2).
  useClickOutside([triggerRef, ref], true, onClose)
  const apply = (c: string) => { setHex(c); onChange(c) }
  // Curated soft palette only — no free colour wheel/hex, so labels stay calm and
  // consistent in light + dark across statuses / funnel / candidate types / pools / …
  return createPortal(
    // Floating popup under its trigger; used both on plain settings rows and inside
    // modals (LocationFormModal, CandidateLookupItemModal) — the CSS popover rung
    // mirrors SelectMenu/CreatableSelect so it always beats a hosting dialog's band.
    <div ref={ref} tabIndex={-1} style={{ position: 'fixed', zIndex: 'var(--z-popover)', background: 'var(--surface)', border: '1px solid var(--border)',
                             borderRadius: 10, padding: 12, boxShadow: 'var(--shadow-float)', width: 192,
                             visibility: rect ? 'visible' : 'hidden', top: rect ? rect.bottom + 4 : 0, left: rect ? rect.left : 0 }}>
      <ColorPaletteGrid value={hex} onPick={apply} />
    </div>,
    document.body,
  )
}

// Swatch trigger plus its picker popup; the only state it owns is whether the popup is open.
// `disabled` is accepted (SchemaSection's color field passes it) but, like the
// original untyped component, not yet wired to any visual/interactive state.
interface ColorSwatchProps { color?: string; onChange: (c: string) => void; disabled?: boolean }
export function ColorSwatch({ color, onChange }: ColorSwatchProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={triggerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- swatch trigger (its own fill IS the picked colour value), not a Button
        style={{ width: 28, height: 28, borderRadius: 6, background: color, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
      {open && <ColorPickerPopup triggerRef={triggerRef} color={color} onChange={c => { onChange(c) }} onClose={() => setOpen(false)} />}
    </div>
  )
}

// Small pill toggle (used by Roles permissions and notification preferences).
// Thin alias over the shared Toggle (Toggle.tsx, "the ONE toggle-switch
// implementation in the app") — this used to hand-roll its own <button> markup,
// duplicating role=switch/aria-checked/type=button/disabled that Toggle already
// implements (audit finding, 05-08). The 7 call sites (RolesPermissionMatrix,
// CandidateRequiredFieldsSettings, FlatRequiredFieldsToggleList,
// CustomerPhaseRequiredFieldsMatrix, EventCatalog) keep their exact API —
// `checked` + a no-argument `onChange`, plus the HTML `aria-label`/`title`
// attributes some of them pass — so none of them need to change.
interface PermissionToggleProps {
  checked: boolean
  onChange: () => void
  'aria-label'?: string
  title?: string
  disabled?: boolean
}
export function PermissionToggle({ checked, onChange, 'aria-label': ariaLabel, ...rest }: PermissionToggleProps) {
  return <Toggle checked={checked} onChange={() => onChange()} ariaLabel={ariaLabel} {...rest} />
}

// Per-row "Standaard" (is_default) singleton toggle — soft-chip convention (§4):
// tinted primary background/border, never a solid fill. By default the ACTIVE pill
// stays clickable so clicking it CLEARS the default (DEFAULT-UNDO, Danny 04-08:
// "je kan niet undo doen" — you can't undo it) — same soft-tint spec, stronger
// tint + weight 600 when active; the caller owns the singleton flip/clear PUT
// (only one row true at a time).
// `undoable={false}` opts a caller BACK into the old one-way ratchet (active pill
// hard-disabled) for the rare backend that rejects clearing the flag — see
// CandidateLookupsSettings.jsx's funnel-types/phases usage for the verified case.
interface DefaultToggleProps {
  active: boolean
  onClick: () => void
  busy?: boolean
  activeLabel: string
  inactiveLabel: string
  undoable?: boolean
  title?: string
}
export function DefaultToggle({ active, onClick, busy, activeLabel, inactiveLabel, undoable = true, title }: DefaultToggleProps) {
  const disabled = busy || (!undoable && active)
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      title={title ?? (active ? activeLabel : inactiveLabel)}
      // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- §4 soft-tint singleton pill (undo-able active/inactive), not a Button
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 9px',
        fontSize: 11, fontWeight: active ? 600 : 500, borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
        border: tintBorder('var(--color-primary)', active),
        background: tintBg('var(--color-primary)', active),
        color: 'var(--color-primary-text)', cursor: disabled ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}>
      {active && <Check size={10} />}
      {active ? activeLabel : inactiveLabel}
    </button>
  )
}

// sortable=false renders the same rows without drag affordances — for lookup
// families whose backend has no /reorder route (SimpleLookupController): a drag
// would PUT a nonexistent endpoint and 404-toast on every drop.
//
// bare=true drops this list's OWN row padding/border (a caller whose renderItem
// already renders its own full-width divider/spacing — e.g. the candidate
// Background sub-tabs, DRAG-SORT-1 — would otherwise get it twice). The
// drag-feedback opacity/highlight stays either way; only the chrome differs.
//
// KEYBOARD-REORDER-1: mouse-only drag-and-drop is not keyboard operable (§6) —
// this had no alternative at all before DRAG-SORT-1 needed one. A move-up/
// move-down pair per row is the smallest real path: each is a normal focusable
// `<button>` with an accessible name, so Tab + Enter/Space reorders exactly like
// a drag would, calling the same `onReorder(next)` the mouse path uses — one
// reorder contract, two ways to drive it. This fixes every existing DragList
// caller's keyboard gap too (e.g. ReportKpiSettings), not just the new one.
interface DragListProps<T> {
  items: T[]
  onReorder: (next: T[]) => void
  renderItem: (item: T, index: number) => ReactNode
  sortable?: boolean
  bare?: boolean
}
export function DragList<T>({ items, onReorder, renderItem, sortable = true, bare = false }: DragListProps<T>) {
  const { t } = useTranslation('common')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  // Mouse-drop reorder: moves the dragged item to the hovered index and persists via onReorder.
  const handleDrop = () => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) { setDragIdx(null); setOverIdx(null); return }
    const next = [...items]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(overIdx, 0, moved)
    onReorder(next)
    setDragIdx(null); setOverIdx(null)
  }

  // Swap item `from` with the row directly above/below it and persist — the
  // keyboard equivalent of a one-step drag (out-of-range moves are no-ops, also
  // guarded by the buttons' own `disabled` at the list's ends).
  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder(next)
  }

  const moveBtnStyle = (disabled: boolean) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 12,
    background: 'none', border: 'none', padding: 0, color: disabled ? 'var(--border)' : 'var(--text-muted)',
    cursor: disabled ? 'default' : 'pointer',
  })

  return (
    <div>
      {items.map((item, i) => {
        const isFirst = i === 0, isLast = i === items.length - 1
        const itemId = (item as { id?: string | number }).id
        return (
          <div key={itemId ?? i}
            draggable={sortable}
            onDragStart={sortable ? () => setDragIdx(i) : undefined}
            onDragOver={sortable ? e => { e.preventDefault(); setOverIdx(i) } : undefined}
            onDrop={sortable ? handleDrop : undefined}
            onDragEnd={sortable ? () => { setDragIdx(null); setOverIdx(null) } : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: bare ? 0 : '10px 0',
                     // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this row divider/drag-over tint; kept literal to avoid changing the rendered tone
                     borderBottom: bare ? 'none' : '1px solid #F3F4F6', opacity: dragIdx === i ? 0.4 : 1,
                     // eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this drag-over highlight tint; kept literal to avoid changing the rendered tone
                     background: overIdx === i && dragIdx !== i ? '#F0F9FF' : 'transparent',
                     borderRadius: 6, transition: 'background 0.1s' }}>
            {sortable && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <button type="button" onClick={() => moveTo(i, i - 1)} disabled={isFirst}
                  aria-label={t('dragList.moveUp')} title={t('dragList.moveUp')}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tiny 14×12 keyboard-reorder arrow embedded in the drag row, not a Button
                  style={moveBtnStyle(isFirst)}>
                  <ChevronUp size={11} />
                </button>
                {/* eslint-disable-next-line no-restricted-syntax -- no exact/close index.css token match for this grip-icon grey; kept literal to avoid changing the rendered tone */}
                <GripVertical size={14} style={{ color: '#D1D5DB', cursor: 'grab' }} aria-hidden="true" />
                <button type="button" onClick={() => moveTo(i, i + 1)} disabled={isLast}
                  aria-label={t('dragList.moveDown')} title={t('dragList.moveDown')}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tiny 14×12 keyboard-reorder arrow embedded in the drag row, not a Button
                  style={moveBtnStyle(isLast)}>
                  <ChevronDown size={11} />
                </button>
              </div>
            )}
            {renderItem(item, i)}
          </div>
        )
      })}
    </div>
  )
}
