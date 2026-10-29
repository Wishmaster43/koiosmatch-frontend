import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Register + spelling guards (ONIX lane 18): de stays formal "Sie", it keeps its accents, fr/it use one apostrophe style.
const dir = path.resolve(import.meta.dirname, 'locales')
const load = (loc, ns) => JSON.parse(fs.readFileSync(path.join(dir, loc, `${ns}.json`), 'utf8'))
const strings = (node, acc = []) => {
  if (typeof node === 'string') acc.push(node)
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => strings(v, acc))
  return acc
}

const DU = /\b(du|dich|dir|dein\w*)\b/i
const DU_IMPERATIVE = /^(Wähle |Versuche |Fordere |Gib |Bitte deine|Bitte versuche |Bitte wähle )/
const duHits = (list) => list.filter((s) => DU.test(s) || DU_IMPERATIVE.test(s))

describe('de auth register', () => {
  it.each(['login', 'forgot', 'reset', 'invite', 'setPassword', 'mfa'])('%s uses Sie, never du', (section) => {
    expect(duHits(strings(load('de', 'auth')[section]))).toEqual([])
  })
  it('the checker flags du forms (fixture)', () => {
    expect(duHits(['Wähle ein Passwort', 'Bitte versuche es erneut', 'Wählen Sie ein Passwort'])).toHaveLength(2)
  })
  it('the de upload and facebook notification texts are formal', () => {
    expect(duHits([load('de', 'common').upload.tooLarge])).toEqual([])
    expect(duHits(strings(load('de', 'notifications').facebook ?? {}))).toEqual([])
  })
})

describe('pt notifications use European Portuguese', () => {
  it('has no Brazilian gerund "aguardando"', () => {
    expect(strings(load('pt', 'notifications')).filter((s) => /\baguardando\b/i.test(s))).toEqual([])
  })
})

const IT_BAD = /\bpiu\b|\bgia\b|\bperche\b|\bnon e\b|\b(sessione|account|azione|funzione) e (scadut|disponibil|abilitat|riuscit|collegat)/
describe('it spelling keeps its accents', () => {
  it('it/auth.json has no unaccented più/è/già/perché', () => {
    expect(strings(load('it', 'auth')).filter((s) => IT_BAD.test(s))).toEqual([])
  })
  it('keeps the conjunction "e stato" (fixture)', () => {
    expect(IT_BAD.test('posizione e stato')).toBe(false)
    expect(IT_BAD.test('La sessione e scaduta')).toBe(true)
  })
})

describe('fr/it auth use one apostrophe style', () => {
  it.each(['fr', 'it'])('%s auth.json has no straight apostrophe in values', (loc) => {
    expect(strings(load(loc, 'auth')).filter((s) => s.includes("'"))).toEqual([])
  })
})
