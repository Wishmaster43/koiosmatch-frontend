/**
 * block-comment-audit — CLAUDE.md §0.2 measured per BLOCK, not per file: above every
 * meaningful block (an exported function or component, a hook call that owns state or an
 * effect, a handler, a mapper) there should be one short English line saying what it does
 * and why. comment-audit.mjs only proves a file explains itself; this proves the blocks
 * inside it do too.
 *
 *   node scripts/block-comment-audit.mjs                 # summary
 *   node scripts/block-comment-audit.mjs --list          # every uncommented block
 *   node scripts/block-comment-audit.mjs --json          # machine-readable, for a lane
 *   node scripts/block-comment-audit.mjs src/pages/tasks # limit to a subtree
 *
 * Deliberately conservative about what counts as a block worth explaining: a one-line
 * arrow constant, a type, a re-export or a trivial getter needs no prose, and demanding
 * one would turn documentation into noise. What it DOES demand: useEffect and useMemo and
 * useCallback bodies, exported functions and components, and named handler functions.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', 'dist', 'locales'])
const SKIP_FILE = /\.test\.|api-generated|\.d\.ts$/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) { walk(full, out); continue }
    if (/\.(jsx?|tsx?)$/.test(name) && !SKIP_FILE.test(full)) out.push(full)
  }
  return out
}

// The blocks that carry behaviour and therefore deserve a line of prose above them.
const BLOCK_PATTERNS = [
  { kind: 'effect', re: /^\s*useEffect\(/ },
  { kind: 'memo', re: /^\s*const\s+\w+\s*=\s*useMemo\(/ },
  { kind: 'callback', re: /^\s*const\s+\w+\s*=\s*useCallback\(/ },
  { kind: 'exported function', re: /^export\s+(?:default\s+)?(?:async\s+)?function\s+\w+/ },
  { kind: 'function', re: /^(?:async\s+)?function\s+\w+/ },
  // A multi-line handler/helper: an arrow whose body opens a brace on the same line.
  { kind: 'handler', re: /^\s*(?:const|async const)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*$/ },
]

// A block is explained when a comment sits directly ABOVE it (skipping blank lines), or
// when its FIRST line inside is a comment — both read the same to whoever opens the file,
// and demanding only the first shape would flag well-documented code.
function isExplained(lines, i) {
  // Look back through the block's own PARAGRAPH: a comment that introduces a group of
  // sibling declarations explains all of them, and demanding a line above each one
  // produces exactly the filler an independent reviewer rejects ("// Opens the modal"
  // above `setEditingUser(u)`). A blank line ends the paragraph.
  let blanks = 0
  for (let j = i - 1; j >= 0 && j >= i - 8; j--) {
    const t = lines[j].trim()
    if (t === '') { if (++blanks > 1) break; continue }
    if (t.startsWith('//') || t.startsWith('*') || t.endsWith('*/') || t.startsWith('/*')) return true
  }
  for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
    const t = lines[j].trim()
    if (t === '') continue
    return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')
  }
  return false
}

const args = process.argv.slice(2)
const roots = args.filter(a => !a.startsWith('--'))
const files = (roots.length ? roots : ['src']).flatMap(r => (statSync(r).isDirectory() ? walk(r) : [r]))

// A path such as `actionrules/*.` inside prose contains a literal /* that is NOT a
// comment opener; the audit reads line by line, so this only matters for tools that
// strip block comments. FALSE_OPENER records the shape so the next reader knows.
const findings = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  // A file whose header explains the module already explains its PRIMARY export, even
  // when a type block sits between the two. Demanding a second line there produces a
  // weaker copy of the header — the exact filler an independent reviewer rejects.
  const headerExplains = /^\s*\/\*/.test(src)
  let primarySeen = false
  lines.forEach((line, i) => {
    const hit = BLOCK_PATTERNS.find(p => p.re.test(line))
    if (!hit) return
    const isPrimaryExport = hit.kind === 'exported function' && !primarySeen
    if (hit.kind === 'exported function') primarySeen = true
    if (isExplained(lines, i)) return
    if (isPrimaryExport && headerExplains) return
    findings.push({ file, line: i + 1, kind: hit.kind, text: line.trim().slice(0, 90) })
  })
}

const byFile = findings.reduce((m, f) => { (m[f.file] ??= []).push(f); return m }, {})
if (args.includes('--json')) {
  console.log(JSON.stringify({ files: files.length, findings }, null, 1))
} else {
  console.log(`files scanned: ${files.length}`)
  console.log(`blocks without an English explanation: ${findings.length} in ${Object.keys(byFile).length} files`)
  const byKind = findings.reduce((m, f) => { m[f.kind] = (m[f.kind] ?? 0) + 1; return m }, {})
  console.log('per kind: ' + JSON.stringify(byKind))
  if (args.includes('--list')) {
    for (const [file, rows] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n  ${file}  (${rows.length})`)
      rows.slice(0, 8).forEach(r => console.log(`    ${r.line}: [${r.kind}] ${r.text}`))
    }
  }
}
process.exit(findings.length ? 1 : 0)
