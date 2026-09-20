import { describe, it, expect } from 'vitest'

// DUPLICATE-KEY-1 (Danny 19-09, raw "conversations.channel.wa_web" on the conversation chip):
// JSON.parse keeps the LAST of two equal keys, so a duplicated key silently deletes every
// translation under the first one. candidates.json carried "channel" twice inside
// "conversations" (an object of channel labels, then a plain string) for weeks. This guard
// walks every locale file with a duplicate-aware parser and fails on the first repeat.
// Raw text through Vite's own glob (same loader family as localeParity.test.ts), so the
// scanner sees the bytes JSON.parse would collapse.
const RAW = import.meta.glob('./locales/*/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

function findDuplicates(text: string): string[] {
  const dups: string[] = []
  // A tiny tokenizer: track the object path from the key order; JSON.parse with a reviver
  // cannot see duplicates, so we scan keys per object depth ourselves.
  const stack: Array<Set<string>> = []
  const path: string[] = []
  let i = 0
  const n = text.length
  let pendingKey: string | null = null
  while (i < n) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1; let s = ''
      while (j < n && text[j] !== '"') { if (text[j] === '\\') { s += text[j] + text[j + 1]; j += 2; continue } s += text[j]; j++ }
      // A string followed by ':' is a key.
      let k = j + 1
      while (k < n && (text[k] === ' ' || text[k] === '\n' || text[k] === '\r' || text[k] === '\t')) k++
      if (text[k] === ':') {
        const set = stack[stack.length - 1]
        if (set) { if (set.has(s)) dups.push([...path, s].join('.')); set.add(s) }
        pendingKey = s
      }
      i = j + 1; continue
    }
    if (c === '{') { stack.push(new Set()); path.push(pendingKey ?? '$'); pendingKey = null }
    else if (c === '}') { stack.pop(); path.pop() }
    else if (c === '[') { stack.push(new Set()); path.push(pendingKey ?? '[]'); pendingKey = null }
    else if (c === ']') { stack.pop(); path.pop() }
    i++
  }
  return dups
}

describe('locale JSON · no duplicate keys (DUPLICATE-KEY-1)', () => {
  const files = Object.keys(RAW).map(k => k.replace('./locales/', ''))
  it.each(files)('%s has no repeated key inside one object', (rel) => {
    const dups = findDuplicates(RAW[`./locales/${rel}`])
    expect(dups).toEqual([])
  })
})
