// Vitest global setup — runs before every test file.
// Adds jest-dom matchers (toBeInTheDocument, toHaveTextContent, …) to Vitest's expect; jest-dom 7 ships the
// Vitest wiring as its own entry (the bare import no longer augments `expect` for Vitest).
import '@testing-library/jest-dom/vitest'

// toHaveInlineStyle — our own matcher for the INLINE style a component sets (the house style paints identity
// through style objects, so that is what the suites assert). jest-dom 7 + jsdom 30 resolve toHaveStyle against the
// COMPUTED style, where a shorthand like `background` serialises in full and var() values stay unresolved, so the
// 170 inline assertions stopped matching; they now say what they mean (toHaveInlineStyle) and jest-dom's toHaveStyle
// keeps its computed-style meaning for anyone who needs it. Both sides pass through the same CSSStyleDeclaration
// (hex/rgb normalised) and compare case-insensitively (jsdom leaves a hex inside a var()-bearing color-mix() untouched).
import { expect } from 'vitest'

const toDeclarations = (css) => {
  if (typeof css !== 'string') return Object.entries(css)
  return css.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(':')
    return [d.slice(0, i).trim(), d.slice(i + 1).trim()]
  })
}

// A bare number means pixels, as in a React style object, except for the unitless CSS properties.
const UNITLESS = new Set(['fontWeight', 'opacity', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'order', 'lineHeight', 'zoom', 'tabSize', 'columnCount', 'orphans', 'widows', 'fillOpacity', 'strokeOpacity'])
const withUnit = (prop, value) => (typeof value === 'number' && !UNITLESS.has(prop) ? `${value}px` : String(value))

const normalise = (prop, value) => {
  value = withUnit(prop, value)
  const probe = document.createElement('div')
  if (prop.startsWith('--') || prop.includes('-')) probe.style.setProperty(prop, String(value))
  else probe.style[prop] = String(value)
  return prop.startsWith('--') || prop.includes('-') ? probe.style.getPropertyValue(prop) : probe.style[prop]
}

expect.extend({
  toHaveInlineStyle(element, css) {
    const actualStyle = element.style
    const decls = toDeclarations(css)
    const mismatches = decls.filter(([prop, value]) => {
      const isDash = prop.startsWith('--') || prop.includes('-')
      const actual = isDash ? actualStyle.getPropertyValue(prop) : actualStyle[prop]
      return String(actual).toLowerCase() !== normalise(prop, value).toLowerCase()
    })
    const pass = decls.length > 0 && mismatches.length === 0
    return {
      pass,
      message: () => `expected inline style ${this.isNot ? 'not ' : ''}to match ${JSON.stringify(decls)}; element style="${element.getAttribute('style')}"`,
    }
  },
})
