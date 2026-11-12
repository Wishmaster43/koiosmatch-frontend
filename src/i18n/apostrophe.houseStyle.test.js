import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Apostrophe guard: fr/it values use the typographic apostrophe between letters, in every namespace file.
const dir = path.resolve(import.meta.dirname, 'locales')
const strings = (node, acc = []) => {
  if (typeof node === 'string') acc.push(node)
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => strings(v, acc))
  return acc
}
// A straight apostrophe between two letters, outside {{interpolations}}; backtick or HTML-tag values are exempt.
const STRAIGHT = /(\p{L})'(?=\p{L})/u
const offenders = (list) =>
  list.filter((s) => !/`|<\/?(b|i|a|br|strong|em|p|ul|li|span|code|div)[\s>/]/i.test(s) && s.split(/(\{\{.*?\}\})/).some((part, i) => i % 2 === 0 && STRAIGHT.test(part)))

describe('fr/it values use the typographic apostrophe', () => {
  it.each(['fr', 'it'])('%s: no straight apostrophe between letters in any namespace', (loc) => {
    const hits = fs
      .readdirSync(path.join(dir, loc))
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => offenders(strings(JSON.parse(fs.readFileSync(path.join(dir, loc, f), 'utf8')))).map((s) => `${f}: ${s}`))
    expect(hits).toEqual([])
  })
  it('the checker flags a straight apostrophe and passes the typographic one (fixture)', () => {
    expect(offenders(["l'équipe", 'l’équipe', 'x {{a\'b}}'])).toHaveLength(1)
  })
})
