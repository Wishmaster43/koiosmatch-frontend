import { describe, expect, it } from 'vitest'
import indexCss from '@/index.css?raw'
import indexHtml from '/index.html?raw'
import careersiteHtml from '/careersite/index.html?raw'
import cspSource from '@/lib/csp.ts?raw'

// ONIX M-003 guard: no external font host may creep back into the shipped files.
const FILES: Record<string, string> = {
  'src/index.css': indexCss,
  'index.html': indexHtml,
  'careersite/index.html': careersiteHtml,
  'src/lib/csp.ts': cspSource,
}
// Hosts are assembled from parts so this guard file never matches its own grep.
const HOSTS = ['googleapis', 'gstatic', 'bunny'].map((h) => `fonts.${h}.`)

describe('fonts are self-hosted', () => {
  it.each(Object.keys(FILES))('%s references no external font host', (file) => {
    for (const host of HOSTS) expect(FILES[file]).not.toContain(host)
  })
})

// Class check (ONIX #303): ANY external origin in font/style loading paths fails, not only known font CDNs.
export function findExternalRefs(file: string, source: string): string[] {
  const hits: string[] = []
  const ext = /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/gi
  if (file.endsWith('.css')) {
    for (const m of source.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)|url\(\s*['"]?([^'")\s]+)/gi)) {
      const ref = m[1] ?? m[2] ?? ''
      if (/^(?:https?:)?\/\//i.test(ref)) hits.push(ref)
    }
  } else if (file.endsWith('.html')) {
    for (const m of source.matchAll(/<(?:link|script)\b[^>]*?(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
      if (/^(?:https?:)?\/\//i.test(m[1])) hits.push(m[1])
    }
  } else {
    for (const m of source.matchAll(/"(font-src|style-src)([^"]*)"/g)) {
      for (const h of m[2].match(ext) ?? []) hits.push(`${m[1]} ${h}`)
    }
  }
  return hits
}

describe('no external host in font/style loading paths', () => {
  it.each(Object.keys(FILES))('%s loads nothing from an external origin', (file) => {
    expect(findExternalRefs(file, FILES[file])).toEqual([])
  })
  it('the checker flags an arbitrary external font host (synthetic)', () => {
    expect(findExternalRefs('x.css', "@import url('https://cdn.example.com/font.css');")).toHaveLength(1)
    expect(findExternalRefs('x.css', '@font-face{src:url(//fonts.example.org/a.woff2)}')).toHaveLength(1)
    expect(findExternalRefs('x.html', '<link rel="stylesheet" href="https://cdn.example.com/a.css">')).toHaveLength(1)
    expect(findExternalRefs('x.ts', `"font-src 'self' https://cdn.example.com"`)).toHaveLength(1)
    expect(findExternalRefs('x.css', "@import '@fontsource/inter/400.css';")).toEqual([])
  })
})
