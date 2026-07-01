#!/usr/bin/env node
/**
 * A11Y-2 detector — lists icon-only <button>s that have no accessible name
 * (no aria-label / aria-labelledby / title and no visible text). §6 requires an
 * accessible name on every control. Read-only; groups by lane so each owner can
 * label their part. Run: `node scripts/audit-a11y-buttons.mjs`
 *
 * Note: an upper bound — a button whose only child is a text variable ({label})
 * is reported as a possible false positive (it may already be labelled by text).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'src'
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.join(d, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.(tsx|jsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
})

// lane = first two path segments under src/ (e.g. pages/settings, components/layout)
const laneOf = (f) => f.replace('src/', '').split('/').slice(0, 2).join('/')

const hits = []
for (const f of walk(ROOT)) {
  const s = fs.readFileSync(f, 'utf8')
  const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g
  let m
  while ((m = re.exec(s))) {
    const [open, inner] = [m[1], m[2]]
    if (/aria-label|aria-labelledby|\btitle=/.test(open)) continue // has an accessible name
    // strip tags; a {…t()…} expression renders visible text (accessible name), so
    // treat it as text; a bare {var} is only a *possible* text label (uncertain).
    const stripped = inner.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, x => /\bt\(/.test(x) ? 'TEXT' : '')
    if (/[A-Za-z]{2,}/.test(stripped)) continue // has visible text → labelled
    const maybeVarText = /\{[a-zA-Z][\w.]*\}/.test(inner) // {label} etc → flag as uncertain
    const line = s.slice(0, m.index).split('\n').length
    hits.push({ f: f.replace('src/', ''), line, lane: laneOf(f), uncertain: maybeVarText })
  }
}

const byLane = {}
for (const h of hits) (byLane[h.lane] ??= []).push(h)

const certain = hits.filter(h => !h.uncertain).length
console.log(`icon-only buttons without an accessible name: ${hits.length} (${certain} certain, ${hits.length - certain} possible {var}-text)\n`)
for (const [lane, list] of Object.entries(byLane).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`── ${lane} (${list.length}) ──`)
  for (const h of list) console.log(`   ${h.f}:${h.line}${h.uncertain ? '  (?)' : ''}`)
}
