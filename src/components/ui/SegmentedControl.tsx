/**
 * SegmentedControl — option-card group replacing hand-rolled radio buttons.
 * Renders as a `radiogroup` with roving-tabindex keyboard support (Left/Right/Up/Down
 * move + select, Home/End jump to first/last) so it behaves like a native radio group
 * for assistive tech while looking like the §4 soft-tint card set.
 *
 * §4 soft-tint: bg = color-mix(token 8-16%, transparent), text = token, border =
 * color-mix(token 28-50%, transparent); active adds fontWeight 600. No i18n inside —
 * labels/descriptions arrive already translated from the caller.
 */
import { useRef, useState } from 'react'
import type { ComponentType, KeyboardEvent } from 'react'
import { tint, chipInk } from '@/lib/tint'

export interface SegmentedControlOption {
  value: string
  label: string
  description?: string
  icon?: ComponentType<{ size?: number }>
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  // Semantic colour token (CSS var or hex) driving the soft-tint. Defaults to primary.
  color?: string
  // Accessible name for the radiogroup (required unless an external <label> already
  // labels it via aria-labelledby, which callers can add themselves).
  ariaLabel?: string
  // 'compact' (audit finding, 05-08): a small inline pill row — no icon/description,
  // no full-width cards — for a spot too tight for the default vertical option-card
  // layout (e.g. CvSectionList's per-row sidebar⇄main switch). Default unchanged.
  size?: 'default' | 'compact'
  // Tint ONLY the selected option, leaving the rest neutral (Danny 11-08, on the
  // package picker: "alleen het gekozen pakket moet groen zijn").
  //
  // The §4 default — an inactive option keeps its own colour, just weaker — is right
  // when each option carries its OWN meaning (a status, a phase): the tint IS the
  // value. It is wrong when every option shares ONE colour that means "this is the
  // active one", because then a faint tint on the others says something untrue. Set
  // this whenever the colour means "on" rather than "which".
  activeOnly?: boolean
  // Arrow keys SELECT by default (native radio behaviour). Pass false when a
  // selection is EXPENSIVE (an audited server write, a tenant-wide switch): then
  // arrows only move focus and Enter/Space commits — the ARIA-sanctioned variant
  // for costly activation. Found the hard way (Opus review, batch C): the Koios
  // model picker fired an audited PUT per arrow press, and its saving-guard then
  // swallowed the user's real target.
  commitOnFocus?: boolean
  // Exact background for the SELECTED option, when the design calls for a flat
  // semantic token instead of a derived tint (e.g. --color-success-bg). Some house
  // tints are their own colour, not a percentage of the accent — measured on
  // --color-success-bg, the closest color-mix is visibly off — so a caller that must
  // match such a surface passes it here rather than approximating it. The border then
  // uses the full `color`, matching that same surface's own border.
  activeFill?: string
  // Ink ON that activeFill pastel. Defaults to --color-on-success-bg because §4's
  // activeFill convention IS the success pair — the raw `color` as ink reads
  // 3.00:1 there (the exact value the round-2 Opus review rejected; caught live
  // again on ModulesSettings' package cards, r4). A caller pairing a different
  // pastel passes its own on-X-bg token here.
  activeInk?: string
}

export default function SegmentedControl({ options, value, onChange, color = 'var(--color-primary)', ariaLabel, size = 'default', activeOnly = false, activeFill, activeInk = 'var(--color-on-success-bg)', commitOnFocus = true }: SegmentedControlProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  // Roving-focus index for commitOnFocus=false: arrows park here; Enter/Space
  // (the button's native click) commits. Reset implicitly: tabIndex falls back
  // to the selected option whenever focus leaves the group.
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const compact = size === 'compact'
  // Ink via chipInk (lib/tint): the primary token gets its tuned --color-primary-text
  // twin; every other token (incl. a light tenant hex) blends toward --text so the
  // label clears AA on its own tint. This also closes the former KNOWN GAP here
  // (ACCENT-INK-1, measured 18-08 on tenant AENF, brand #fef200: a light hex painted
  // as its own raw ink on a 6-14% tint measured 1.05-1.07:1) — chipInk's blend fixes
  // that case too, not just primary. The activeFill branch reads `activeInk` (its
  // pastel's own on-X-bg token, SaveButton precedent) — an earlier comment here
  // claimed no live caller existed; ModulesSettings' package cards were one, at
  // 3.00:1 (Opus r4).
  const ink = chipInk(color)

  // Arrow/Home/End roving focus, mirroring native radiogroup keyboard behaviour —
  // moving focus also selects, exactly like radio inputs.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (index + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = options.length - 1
    if (nextIndex === null) return
    e.preventDefault()
    if (commitOnFocus) onChange(options[nextIndex].value)
    else setFocusIdx(nextIndex)
    refs.current[nextIndex]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 4 : 8 }}>
      {options.map((opt, i) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button key={opt.value} type="button" role="radio" aria-checked={active}
            ref={el => { refs.current[i] = el }}
            tabIndex={(commitOnFocus ? active : i === (focusIdx ?? options.findIndex(o => o.value === value)))
              || (!options.some(o => o.value === value) && focusIdx === null && i === 0) ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={e => onKeyDown(e, i)}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- role="radio" option card with roving-tabindex keyboard support, a structural ARIA role Button does not model
            style={compact ? {
              padding: '3px 9px', fontSize: 10.5, fontWeight: active ? 600 : 500, borderRadius: 999,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              // activeFill pairs with activeInk (its pastel's own on-X-bg token);
              // every other branch uses chipInk.
              // eslint-disable-next-line huisstijl/no-restricted-syntax -- both identifiers ARE derived inks (activeInk = on-X-bg token, ink = chipInk above); provenance is opaque to the tint-ink selector
              color: activeOnly && !active ? 'var(--text-muted)' : active && activeFill ? activeInk : ink,
              background: activeOnly && !active ? 'var(--surface)'
                : active && activeFill ? activeFill
                : tint(color, active ? 14 : 6),
              border: activeOnly && !active ? '1px solid var(--border)'
                : active && activeFill ? `1px solid ${color}`
                : `1px solid ${tint(color, active ? 45 : 20)}`,
            } : {
              display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', width: '100%',
              // eslint-disable-next-line huisstijl/no-restricted-syntax -- both identifiers ARE derived inks (activeInk = on-X-bg token, ink = chipInk above); provenance is opaque to the tint-ink selector
              color: activeOnly && !active ? 'var(--text)' : active && activeFill ? activeInk : ink,
              fontWeight: active ? 600 : 500,
              background: activeOnly && !active ? 'var(--surface)'
                : active && activeFill ? activeFill
                : tint(color, active ? 16 : 8),
              border: activeOnly && !active ? '1px solid var(--border)'
                : active && activeFill ? `1px solid ${color}`
                : `1px solid ${tint(color, active ? 50 : 28)}`,
            }}>
            {compact ? (<>
              {/* Decorative: the LABEL is the accessible name; an icon with its own
                  title (KoiosAiMark) must not double into the radio's name. */}
              {Icon && <span aria-hidden="true" style={{ display: 'inline-flex' }}><Icon size={11} /></span>}
              {opt.label}
            </>) : (
              <>
                {Icon && <Icon size={16} />}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13 }}>{opt.label}</span>
                  {opt.description && <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>{opt.description}</span>}
                </span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
