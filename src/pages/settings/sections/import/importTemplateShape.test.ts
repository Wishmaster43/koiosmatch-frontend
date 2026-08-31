/**
 * importTemplateShape tests — the seam that decides which explanation a user gets.
 * The column lists below are copied VERBATIM from the backend's own templates
 * (ImportTemplateController::TEMPLATES), so this file fails the day the combined
 * template's shape changes — which is exactly when the wizard would otherwise start
 * teaching a four-step import order for a file that has no order at all.
 */
import { describe, it, expect } from 'vitest'
import { groupTemplates, importPermissionsFor, isWholeTreeTemplate, orderedTemplates } from './importTemplateShape'
import type { ImportTemplateSummary } from './importApi'

// ImportTemplateController::TEMPLATES, verbatim.
const CUSTOMERS = ['naam', 'email', 'telefoon', 'plaats', 'kvk_nummer', 'btw_nummer', 'website', 'branche']
const LOCATIONS = ['klant_naam', 'naam', 'straat', 'huisnummer', 'toevoeging', 'postcode', 'plaats', 'land', 'telefoon', 'email', 'kostenplaats']
const DEPARTMENTS = ['klant_naam', 'locatie_naam', 'naam', 'omschrijving', 'kostenplaats']
const CONTACTS = ['klant_naam', 'locatie_naam', 'afdeling_naam', 'voornaam', 'tussenvoegsel', 'achternaam', 'functie', 'email', 'telefoon', 'mobiel', 'hoofdcontact', 'whatsapp_toestemming', 'email_toestemming']
const CUSTOMER_TREE = [
  'klant_naam', 'klant_email', 'klant_telefoon', 'klant_plaats', 'klant_kvk_nummer', 'klant_btw_nummer', 'klant_website', 'klant_branche',
  'locatie_naam', 'locatie_straat', 'locatie_huisnummer', 'locatie_toevoeging', 'locatie_postcode', 'locatie_plaats', 'locatie_land', 'locatie_telefoon', 'locatie_email', 'locatie_kostenplaats',
  'afdeling_naam', 'afdeling_omschrijving', 'afdeling_kostenplaats',
  'voornaam', 'tussenvoegsel', 'achternaam', 'functie', 'email', 'telefoon', 'mobiel', 'hoofdcontact', 'whatsapp_toestemming', 'email_toestemming',
]

const tpl = (entity: string, columns: string[]): ImportTemplateSummary =>
  ({ entity, columns, example_rows: 2, url: `/imports/${entity}/template.csv` })

describe('isWholeTreeTemplate', () => {
  it('recognises the combined file by its columns, not by its slug', () => {
    expect(isWholeTreeTemplate(CUSTOMER_TREE)).toBe(true)
  })

  it('never mistakes a single-entity template for the combined one', () => {
    // `contacts` is the trap: it carries klant_naam AND locatie_naam AND afdeling_naam
    // AND achternaam — but only as LINKS, with no customer detail column of its own.
    expect(isWholeTreeTemplate(CUSTOMERS)).toBe(false)
    expect(isWholeTreeTemplate(LOCATIONS)).toBe(false)
    expect(isWholeTreeTemplate(DEPARTMENTS)).toBe(false)
    expect(isWholeTreeTemplate(CONTACTS)).toBe(false)
  })

  it('treats a missing/empty column list as not-combined', () => {
    expect(isWholeTreeTemplate(undefined)).toBe(false)
    expect(isWholeTreeTemplate([])).toBe(false)
  })
})

describe('grouping', () => {
  // The backend lists customer_tree LAST; the wizard shows it FIRST.
  const all = [
    tpl('customers', CUSTOMERS), tpl('locations', LOCATIONS),
    tpl('departments', DEPARTMENTS), tpl('contacts', CONTACTS), tpl('customer_tree', CUSTOMER_TREE),
  ]

  it('splits the API list into the two real choices', () => {
    const { wholeTree, perEntity } = groupTemplates(all)
    expect(wholeTree.map((x) => x.entity)).toEqual(['customer_tree'])
    expect(perEntity.map((x) => x.entity)).toEqual(['customers', 'locations', 'departments', 'contacts'])
  })

  it('puts the combined file first in display order and keeps the API order within the rest', () => {
    expect(orderedTemplates(all).map((x) => x.entity))
      .toEqual(['customer_tree', 'customers', 'locations', 'departments', 'contacts'])
  })

  it('leaves a backend without a combined template completely unchanged', () => {
    const four = all.slice(0, 4)
    expect(groupTemplates(four).wholeTree).toEqual([])
    expect(orderedTemplates(four).map((x) => x.entity)).toEqual(['customers', 'locations', 'departments', 'contacts'])
  })
})

// CAND-IMPORT-FE-1: candidates carries its OWN permission pair, same least-
// privilege shape as vacancies — never the customer-tree fallback.
describe('importPermissionsFor', () => {
  it('resolves the vacancy pair for vacancies', () => {
    expect(importPermissionsFor('vacancies')).toEqual({ view: 'vacancies.view', create: 'vacancies.create' })
  })

  it('resolves the candidate pair for candidates', () => {
    expect(importPermissionsFor('candidates')).toEqual({ view: 'candidates.view', create: 'candidates.create' })
  })

  it('falls back to the customer-tree pair for every other entity', () => {
    expect(importPermissionsFor('customer_tree')).toEqual({ view: 'customers.view', create: 'customers.create' })
    expect(importPermissionsFor('contacts')).toEqual({ view: 'customers.view', create: 'customers.create' })
    expect(importPermissionsFor(undefined)).toEqual({ view: 'customers.view', create: 'customers.create' })
  })
})

// PUNT-6 (31-08): the five new importers carry their own pairs; matches and
// opportunities gate on .update (no .create right exists), per the BE routes.
describe('importPermissionsFor · PUNT-6 pairs', () => {
  it.each([
    ['applications', 'applications.view', 'applications.create'],
    ['matches', 'matches.view', 'matches.update'],
    ['tasks', 'tasks.view', 'tasks.create'],
    ['opportunities', 'opportunities.view', 'opportunities.update'],
    ['outreach', 'outreach.view', 'outreach.create'],
    // TRANSFER-FAMILIES (31-08): one dedicated right for both halves — the AVG lock.
    ['notes', 'notes.import', 'notes.import'],
    ['conversations', 'conversations.import', 'conversations.import'],
    ['documents', 'documents.import', 'documents.import'],
  ])('%s -> %s / %s', (entity, view, create) => {
    expect(importPermissionsFor(entity)).toEqual({ view, create })
  })
})

