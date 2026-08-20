/**
 * Typography atoms (HUISSTIJL-1, Danny 19-08: "txt grote, txt kleur" — one
 * scale, reused, never re-declared per file). Measured before this existed:
 * 159 hand-styled headings, 371 inline-styled paragraphs and 601 caption
 * spans, all re-picking their own fontSize/fontWeight/colour.
 *
 * Four roles cover the app's real scale (§4: header/meta ~11px, body 12-13px,
 * weights 400-500 body / 600-700 titles, colour only via tokens):
 *   PageTitle    15/600  --text        screen & drawer titles
 *   SectionTitle 13/600  --text        card/section headings
 *   BodyText     13/400  --text        running text (12 via size="sm")
 *   Caption      11/400  --text-muted  meta lines, hints, timestamps
 * Layout (margins) stays with the caller via `style`; the atom owns identity
 * only — the same contract as Button. `as` picks the semantic element so a
 * visual PageTitle can be an h1/h2/h3 for the document outline (§6).
 */
import type { CSSProperties, ElementType, ReactNode } from 'react'

interface TypoProps {
  children: ReactNode
  as?: ElementType
  style?: CSSProperties
  id?: string
  title?: string
}

const make = (defaults: CSSProperties, defaultTag: ElementType) =>
  function Typo({ children, as, style, ...rest }: TypoProps) {
    const Tag = (as ?? defaultTag) as ElementType
    return <Tag style={{ margin: 0, ...defaults, ...style }} {...rest}>{children}</Tag>
  }

// Raw style identities — the ONE legal source when code genuinely needs the
// style OBJECT (r6 finding T-1: a style-object context, e.g. a style factory,
// needs a legal source or it re-declares the identity — exactly how
// SectionCard's sectionTitle copy was born). JSX always renders the atoms
// below, never these directly.
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the canonical PageTitle style identity itself, not a hand-styled copy
export const pageTitleStyle: CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text)' }
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the canonical SectionTitle style identity itself, not a hand-styled copy
export const sectionTitleStyle: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)' }
export const bodyTextStyle: CSSProperties = { fontSize: 13, fontWeight: 400, color: 'var(--text)', lineHeight: 1.5 }
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the canonical Caption style identity itself, not a hand-styled copy
export const captionStyle: CSSProperties = { fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }
// letterSpacing 0.04em (Opus r10): 41 of 42 call sites overrode the old 0.05em
// default to 0.04 — reality had voted; the default now IS the identity and the
// remaining overrides are same-value no-ops that retire per touch.
// eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- the canonical GroupLabel style identity itself, not a hand-styled copy
export const groupLabelStyle: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em' }

export const PageTitle = make(pageTitleStyle, 'h2')
export const SectionTitle = make(sectionTitleStyle, 'h3')
export const BodyText = make(bodyTextStyle, 'p')
export const Caption = make(captionStyle, 'span')
// Uppercase group label (the 11px/600 tracked heading the settings cards use).
export const GroupLabel = make(groupLabelStyle, 'div')
// Numbers/IDs/code — JetBrains Mono per §1; size rides with the surrounding text.
export const Mono = make({ fontFamily: "'JetBrains Mono', monospace" }, 'span')
