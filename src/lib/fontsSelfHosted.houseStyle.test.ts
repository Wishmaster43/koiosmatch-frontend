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
