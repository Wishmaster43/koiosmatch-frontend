/**
 * Heavy-deps guard (GAPS-A1): @react-pdf/renderer may only be imported STATICALLY by the CV
 * document modules and the lazy renderer; every other file loads it through `await import()`
 * so the ~600 kB PDF engine never lands in a shared chunk.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const SRC = resolve('src')
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^'"()]*?\sfrom\s+)?['"]@react-pdf\/renderer(?:\/[^'"]*)?['"]/m
// Explicit allow-list (repo-relative); the cv folder is the PDF module, the rest are its document root.
const ALLOWED = [/^src\/pages\/candidates\/cv\//, /^src\/pages\/candidates\/CandidateCvTemplate\.tsx$/]

// List every source file under a folder (tests excluded).
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) ? [full] : []
  })
}

describe('heavy dependency imports', () => {
  it('imports @react-pdf/renderer statically only from the allowed CV modules', () => {
    const files = walk(SRC)
    // Sanity: a broken walker must not pass vacuously.
    expect(files.length).toBeGreaterThan(1000)
    const offenders = files
      .map(f => 'src/' + relative(SRC, f))
      .filter(rel => STATIC_IMPORT.test(readFileSync(rel, 'utf8')) && !ALLOWED.some(re => re.test(rel)))
    expect(offenders).toEqual([])
  })

  // Self-test of the matcher: static forms hit, a dynamic import does not.
  it('STATIC_IMPORT matches static and re-export forms but not a dynamic import', () => {
    expect(STATIC_IMPORT.test("import { pdf } from '@react-pdf/renderer'")).toBe(true)
    expect(STATIC_IMPORT.test("import {\n  View,\n  Text\n} from '@react-pdf/renderer'")).toBe(true)
    expect(STATIC_IMPORT.test("export { pdf } from '@react-pdf/renderer'")).toBe(true)
    expect(STATIC_IMPORT.test("const m = await import('@react-pdf/renderer')")).toBe(false)
  })

  // Self-test of the allow-list.
  it('ALLOWED accepts the CV modules and rejects other folders', () => {
    const allowed = rel => ALLOWED.some(re => re.test(rel))
    expect(allowed('src/pages/candidates/cv/cvStyles.ts')).toBe(true)
    expect(allowed('src/pages/settings/X.tsx')).toBe(false)
  })
})
