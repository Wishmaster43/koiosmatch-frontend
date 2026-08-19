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

export const PageTitle = make({ fontSize: 15, fontWeight: 600, color: 'var(--text)' }, 'h2')
export const SectionTitle = make({ fontSize: 13, fontWeight: 600, color: 'var(--text)' }, 'h3')
export const BodyText = make({ fontSize: 13, fontWeight: 400, color: 'var(--text)', lineHeight: 1.5 }, 'p')
export const Caption = make({ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }, 'span')
// Uppercase group label (the 11px/600 tracked heading the settings cards use).
export const GroupLabel = make({ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em' }, 'div')
// Numbers/IDs/code — JetBrains Mono per §1; size rides with the surrounding text.
export const Mono = make({ fontFamily: "'JetBrains Mono', monospace" }, 'span')
