/**
 * entityFields — the REQUIRED subset of each importer's columns, mirrored from the
 * backend (koiosmatch-api app/Services/Import/Importers/*Importer.php,
 * requiredColumns()). GET /imports/templates already returns the FULL column list for
 * an entity (never hardcoded here — see useImportTemplates); only which of those are
 * required is missing from that response, so the mapping step needs this small mirror
 * to warn BEFORE a submit that would otherwise 422. Same accepted mirroring pattern the
 * importers themselves already use for their Form Request rules (see e.g.
 * CustomerLocationImporter::rules()'s own docblock) — flagged here for the same reason:
 * a backend change to requiredColumns() needs this list updated too.
 */
export const REQUIRED_COLUMNS_BY_ENTITY: Record<string, string[]> = {
  // CustomerImporter::requiredColumns()
  customers: ['naam'],
  // CustomerLocationImporter::requiredColumns()
  locations: ['klant_naam', 'naam'],
  // CustomerDepartmentImporter::requiredColumns()
  departments: ['klant_naam', 'locatie_naam', 'naam'],
  // CustomerContactImporter::requiredColumns()
  contacts: ['klant_naam', 'voornaam', 'achternaam'],
  // CustomerTreeImporter::requiredColumns() — every deeper level is optional per row,
  // level truncation stops the row at whichever level has no name supplied.
  customer_tree: ['klant_naam'],
}

/** Required target columns for one entity — [] for an entity this mirror doesn't know yet. */
export function requiredColumnsFor(entity: string): string[] {
  return REQUIRED_COLUMNS_BY_ENTITY[entity] ?? []
}
