/**
 * mapping.ts — pure functions behind the wizard's column-mapping step: suggest a
 * mapping by header-name similarity, apply a manual override, report which required
 * target columns are still unmapped, and turn the parsed source rows into the rows
 * that will actually be sent (the payload builder, keyed by the entity's own backend
 * column names — never the source file's own header spelling).
 */
import { normaliseHeader } from './csv'
import { requiredColumnsFor } from './entityFields'

/** Sentinel target meaning "do not import this column" — never a real column name. */
export const SKIP = '__skip__'

/** source header (as uploaded) -> target column name, or SKIP. */
export type ColumnMapping = Record<string, string>

const TREE_PREFIXES = ['klant_', 'locatie_', 'afdeling_'] as const

// A small bridge for a source file named in English (or loosely) against the
// backend's own Dutch column vocabulary. This only SUGGESTS a mapping — every
// suggestion stays overridable in the UI, so a missing/wrong synonym is never a
// blocker, only a slightly worse first guess.
const SYNONYMS: Record<string, string[]> = {
  naam: ['name', 'company', 'company_name', 'customer_name', 'client_name', 'client'],
  klant_naam: ['customer', 'customer_name', 'client', 'client_name', 'company', 'company_name', 'klant'],
  email: ['e_mail', 'mail', 'email_address', 'emailaddress'],
  telefoon: ['phone', 'telephone', 'tel', 'phone_number'],
  plaats: ['city', 'town'],
  kvk_nummer: ['coc_number', 'coc', 'chamber_of_commerce', 'chamber_of_commerce_number'],
  btw_nummer: ['vat_number', 'vat'],
  website: ['url', 'site', 'web'],
  branche: ['industry', 'sector'],
  straat: ['street'],
  huisnummer: ['house_number', 'housenumber', 'number', 'no', 'nr'],
  toevoeging: ['suffix', 'house_number_suffix', 'addition'],
  postcode: ['zip', 'zipcode', 'zip_code', 'postal_code'],
  land: ['country'],
  kostenplaats: ['cost_center', 'costcenter', 'cost_centre'],
  locatie_naam: ['location', 'location_name', 'site', 'branch'],
  afdeling_naam: ['department', 'department_name', 'team'],
  voornaam: ['first_name', 'firstname', 'given_name'],
  tussenvoegsel: ['middle_name', 'middlename', 'prefix', 'infix'],
  achternaam: ['last_name', 'lastname', 'surname', 'family_name'],
  functie: ['function', 'role', 'job_title', 'title', 'position'],
  mobiel: ['mobile', 'cell', 'cellphone', 'mobile_number'],
  hoofdcontact: ['primary', 'is_primary', 'main_contact', 'primary_contact'],
  whatsapp_toestemming: ['whatsapp_consent', 'whatsapp_opt_in', 'whatsapp_optin'],
  email_toestemming: ['email_consent', 'email_opt_in', 'email_optin'],
  omschrijving: ['description', 'notes', 'remarks'],
}

// A prefixed tree column (klant_email, locatie_straat, …) also accepts its base
// column's own synonyms, so the table above is written once rather than per level.
function candidatesFor(target: string): string[] {
  const own = SYNONYMS[target] ?? []
  for (const prefix of TREE_PREFIXES) {
    if (target.startsWith(prefix) && target !== `${prefix}naam`) {
      const base = target.slice(prefix.length)
      return [...own, base, ...(SYNONYMS[base] ?? [])]
    }
  }
  return own
}

/**
 * Suggest a mapping: for each target column (in the entity's own order), claim the
 * first unclaimed source header that normalises to an exact match on the target
 * itself or one of its synonyms. Any source header left over defaults to SKIP — the
 * mapping step marks it "will be skipped" rather than silently dropping it unnoticed.
 */
export function autoMapColumns(sourceHeaders: readonly string[], targetColumns: readonly string[]): ColumnMapping {
  const normalisedSources = sourceHeaders.map(normaliseHeader)
  const claimed = new Set<string>()
  const mapping: ColumnMapping = {}

  for (const target of targetColumns) {
    const candidates = new Set([target, ...candidatesFor(target)].map(normaliseHeader))
    const matchIndex = normalisedSources.findIndex((header, i) => !claimed.has(sourceHeaders[i]) && candidates.has(header))
    if (matchIndex !== -1) {
      mapping[sourceHeaders[matchIndex]] = target
      claimed.add(sourceHeaders[matchIndex])
    }
  }

  for (const header of sourceHeaders) {
    if (!(header in mapping)) mapping[header] = SKIP
  }

  return mapping
}

/**
 * Apply a manual override: point one source column at a target. A target may only
 * ever be claimed by ONE source column, so re-pointing another header there clears
 * its PREVIOUS owner back to SKIP — otherwise two columns would silently map to the
 * same field with no explanation of which one actually wins.
 */
export function setMapping(mapping: ColumnMapping, sourceHeader: string, target: string): ColumnMapping {
  const next: ColumnMapping = { ...mapping }
  if (target !== SKIP) {
    for (const header of Object.keys(next)) {
      if (header !== sourceHeader && next[header] === target) next[header] = SKIP
    }
  }
  next[sourceHeader] = target
  return next
}

/** Source columns the current mapping leaves unmapped — shown as "will be skipped". */
export function unmappedSourceColumns(mapping: ColumnMapping): string[] {
  return Object.keys(mapping).filter((header) => mapping[header] === SKIP)
}

/** Required target columns (entityFields.ts) with no source column mapped to them yet. */
export function missingRequiredColumns(mapping: ColumnMapping, entity: string): string[] {
  const mappedTargets = new Set(Object.values(mapping).filter((target) => target !== SKIP))
  return requiredColumnsFor(entity).filter((column) => !mappedTargets.has(column))
}

/**
 * The payload builder: turn the parsed source rows into the rows that will actually
 * be sent, one object per row keyed by the entity's own backend column name — never
 * the source file's header spelling. A row where every mapped cell is blank is
 * dropped: it carries no intent, exactly CsvFile.php's own "row where every cell is
 * blank" rule, so the preview never shows a row the real import would skip anyway.
 */
export function buildMappedRows(
  sourceHeaders: readonly string[],
  sourceRows: readonly string[][],
  mapping: ColumnMapping,
): Array<Record<string, string>> {
  const columnIndex = new Map(sourceHeaders.map((header, i) => [header, i]))
  const mappedRows: Array<Record<string, string>> = []

  for (const row of sourceRows) {
    const record: Record<string, string> = {}
    for (const [header, target] of Object.entries(mapping)) {
      if (target === SKIP) continue
      const index = columnIndex.get(header)
      const raw = index !== undefined ? row[index] : undefined
      record[target] = (raw ?? '').trim()
    }
    if (Object.values(record).some((value) => value !== '')) mappedRows.push(record)
  }

  return mappedRows
}
