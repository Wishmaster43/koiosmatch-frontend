/**
 * csv.ts — client-side CSV parse/serialize for the import wizard.
 *
 * No CSV parsing library exists in this repo (verified: no papaparse/csv-parse/xlsx
 * in package.json) and every existing import flow (the settings "importeren" wizard,
 * the shared EntityImportCard) uploads the raw File straight to the backend, which parses it
 * server-side (koiosmatch-api app/Services/Import/CsvFile.php). This wizard needs the
 * parsed rows CLIENT-side for column mapping + an editable preview, so this is a
 * small, dependency-free parser — not a new dependency, per the task's instruction to
 * check first. It mirrors CsvFile.php's own rules (delimiter sniff, header
 * normalisation, BOM strip, Windows-1252 fallback) so a mapping suggestion made here
 * matches what the backend would call the same column.
 */

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

// Built via charCode (not a literal) so no raw BOM character sits inside this
// source file — mirrors CsvFile.php stripping the same mark Excel writes.
const UTF8_BOM = String.fromCharCode(0xfeff)

// Hard caps mirrored from the backend so the upload step can warn BEFORE a POST
// that would 422 anyway (koiosmatch-api CsvFile::MAX_ROWS, ImportUploadRequest 'max:5120').
export const MAX_IMPORT_ROWS = 2000
export const MAX_IMPORT_FILE_BYTES = 5120 * 1024

// Mirrors CsvFile::normaliseHeader — lower-case, accents stripped, non-alphanumeric
// runs collapsed to one underscore, so "Klant Naam " / "Klant-Naam" / "café" all
// compare equal to the backend's own column keys.
// Built via charCode rather than a literal escape so no raw combining character
// sits inside this source file (U+0300-U+036F = the "combining diacritical marks"
// block NFD splits an accent into, e.g. e + U+0301 for "é").
const COMBINING_MARK_RANGE = `${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}`
const COMBINING_DIACRITICS = new RegExp(`[${COMBINING_MARK_RANGE}]`, 'g')

// Normalises one CSV header the same way the backend's own CsvFile.php does (lowercase, strip accents, non-alnum to underscore), so a mapping suggestion made here matches what the server would call the same column.
export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD').replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Mirrors CsvFile::sniffDelimiter — whichever of ; , tab occurs most in the header line.
export function sniffDelimiter(headerLine: string): string {
  const candidates: Array<';' | ',' | '\t'> = [';', ',', '\t']
  const counts = candidates.map((d) => (headerLine.split(d).length - 1))
  const bestIndex = counts.reduce((best, count, index) => (count > counts[best] ? index : best), 0)
  return counts[bestIndex] > 0 ? candidates[bestIndex] : ';'
}

/**
 * Parse a whole CSV text into a normalised header row + data rows. Walks the text
 * as one state machine (quoted-field aware) rather than a naive split('\n'), so a
 * quoted embedded newline or delimiter is never mistaken for a new row/column —
 * exactly what CsvFile.php's fgetcsv-based reader already tolerates.
 */
export function parseCsvText(text: string): ParsedCsv {
  const content = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text
  const firstLine = content.split(/\r\n|\r|\n/, 1)[0] ?? ''
  const delimiter = sniffDelimiter(firstLine)

  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0
  const len = content.length

  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); records.push(row); row = [] }

  while (i < len) {
    const char = content[i]
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i += 1; continue
      }
      field += char; i += 1; continue
    }
    if (char === '"') { inQuotes = true; i += 1; continue }
    if (char === delimiter) { pushField(); i += 1; continue }
    if (char === '\r') { i += 1; continue } // CRLF/CR normalised away; \n below ends the row
    if (char === '\n') { pushRow(); i += 1; continue }
    field += char; i += 1
  }
  // A trailing field/row with no final newline is still a record.
  if (field !== '' || row.length > 0) pushRow()

  const headers = (records[0] ?? []).map(normaliseHeader)
  // A row where every cell is blank carries no intent — dropped, mirroring CsvFile.php.
  const rows = records.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''))

  return { headers, rows }
}

/**
 * Read a File as text, tolerating a non-UTF-8 (Windows-1252) export the same way
 * CsvFile.php does: try strict UTF-8 first, fall back to Windows-1252 so a Dutch
 * Excel "Save as CSV" with accented names is never silently mangled.
 */
export async function readCsvFile(file: File): Promise<ParsedCsv> {
  const buffer = await file.arrayBuffer()
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer)
  }
  return parseCsvText(text)
}

// One CSV cell, quoted only when it needs to be (RFC4180): contains the delimiter,
// a quote (doubled to escape it), or a newline.
function escapeCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Serialize headers + rows back into CSV text: ';' delimiter (mirrors the backend's
 * own template files) and a leading UTF-8 BOM (mirrors ImportTemplateController's
 * download) so Excel opens the re-uploaded file exactly as the backend's own
 * examples do.
 */
export function buildCsvText(headers: string[], rows: string[][], delimiter = ';'): string {
  const lines = [headers, ...rows].map((r) => r.map((cell) => escapeCell(cell, delimiter)).join(delimiter))
  return UTF8_BOM + lines.join('\r\n') + '\r\n'
}
