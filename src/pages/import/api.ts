/**
 * api.ts — the import wizard's request layer. Re-exports the EXISTING import
 * request functions (§11 "reuse, never duplicate") rather than re-implementing the
 * same HTTP calls: GET /imports/templates, GET /imports/{entity}/template.csv,
 * POST /imports/{entity}/dry-run and POST /imports/{entity} already live in
 * settings/sections/import/importApi.ts, used unchanged by both the settings
 * import screen AND the shared EntityImportCard's useEntityImportCard (customers +
 * vacancies create-modal imports). The one thing this wizard adds on top is
 * buildImportFile: turning the MAPPED + user-edited rows back into a File the
 * existing dry-run/run endpoints accept.
 */
import { buildCsvText } from './lib/csv'

export {
  fetchImportTemplates, downloadImportTemplate, dryRunImport, runImport,
  type ImportTemplateSummary, type ImportRowAction, type ImportRowResult,
  type ImportSummary, type ImportRunResult,
} from '@/pages/settings/shared'

/**
 * Build the CSV file to upload: headers = the entity's OWN target columns, in their
 * template order (never the mapping object's insertion order), so the preview table
 * and the actual request always show the same column order. Missing cells become
 * blank ("not supplied" — never invented), matching what buildMappedRows already
 * guarantees for every row it produced.
 */
export function buildImportFile(entity: string, targetColumns: readonly string[], rows: ReadonlyArray<Record<string, string>>): File {
  const cells = rows.map((row) => targetColumns.map((column) => row[column] ?? ''))
  const text = buildCsvText([...targetColumns], cells)
  return new File([text], `${entity}.csv`, { type: 'text/csv' })
}
