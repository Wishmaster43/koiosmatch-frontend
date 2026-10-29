// stripComments — blanks `// …` and `/* … */` comments with spaces while keeping every newline
// and column, and leaves string, template and regex literals untouched. One pass, no regex:
// the english-code counter's old regex stripper opened a "comment" on a `/*` inside a glob
// string ('**/*.test.*') and blanked code up to the next `*/`, sometimes across lines, and a
// `//` inside a URL string blanked the rest of that line (ONIX-RECHECK-1 #231, 29-10-2026).

// Characters after which a `/` starts a regex literal rather than a division.
const REGEX_PREFIX = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^'])
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'instanceof', 'do', 'else', 'yield', 'await'])

// Skips a quoted string from the opening quote; returns the index after the closing quote.
function skipQuoted(src, i, quote) {
  let j = i + 1
  while (j < src.length && src[j] !== quote && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
  return j + 1
}

// Skips a regex literal (character classes and escapes included) plus its flags.
function skipRegex(src, i) {
  let j = i + 1, inClass = false
  while (j < src.length && src[j] !== '\n') {
    const c = src[j]
    if (c === '\\') { j += 2; continue }
    if (inClass) { if (c === ']') inClass = false }
    else if (c === '[') inClass = true
    else if (c === '/') { j++; break }
    j++
  }
  while (j < src.length && /[a-z]/i.test(src[j])) j++
  return j
}

// The word that ends right before index i (for the `return /re/` style regex positions).
function wordBefore(src, i) {
  let j = i
  while (j > 0 && /[A-Za-z_$]/.test(src[j - 1])) j--
  return src.slice(j, i)
}

export function stripComments(src) {
  const out = src.split('')
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ' }
  // Scans code from i; inside a template `${ }` it returns at the matching close brace.
  const scan = (i, insideTemplateExpression) => {
    let prev = '', depth = 0
    while (i < src.length) {
      const c = src[i], d = src[i + 1]
      if (c === '/' && d === '/') { let j = i; while (j < src.length && src[j] !== '\n') j++; blank(i, j); i = j; continue }
      if (c === '/' && d === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2; blank(i, j); i = j; continue }
      if (c === "'" || c === '"') { i = skipQuoted(src, i, c); prev = c; continue }
      if (c === '`') { i = skipTemplate(i); prev = '`'; continue }
      if (c === '/') {
        const word = wordBefore(src, i)
        if (REGEX_PREFIX.has(prev) || REGEX_KEYWORDS.has(word)) { i = skipRegex(src, i); prev = '/'; continue }
      }
      if (insideTemplateExpression) {
        if (c === '{') depth++
        else if (c === '}') { if (depth === 0) return i; depth-- }
      }
      if (!/\s/.test(c)) prev = c
      i++
    }
    return i
  }
  // Skips a template literal, scanning each `${ … }` expression as code (nested templates included).
  const skipTemplate = (i) => {
    let j = i + 1
    while (j < src.length) {
      const c = src[j]
      if (c === '\\') { j += 2; continue }
      if (c === '`') return j + 1
      if (c === '$' && src[j + 1] === '{') { j = scan(j + 2, true) + 1; continue }
      j++
    }
    return j
  }
  scan(0, false)
  return out.join('')
}
