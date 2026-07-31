/**
 * importApi — the real request layer behind the CSV import wizard (replaces the
 * ImporterenSettings mockup that made zero API calls). Every function here hits a
 * live route documented in koiosmatch-api/routes/api/tenant/exports.php:
 * GET /imports/templates, GET /imports/{entity}/template.csv,
 * POST /imports/{entity}/dry-run and POST /imports/{entity}. Types are hand-written —
 * api-generated.ts does not document these routes yet (§10: type what the spec
 * gives you, hand-write the rest).
 */
import api, { unwrap } from '@/lib/api'

// One row from GET /imports/templates — drives the entity sub-nav so a fifth entity
// shows up here the day the backend adds an importer for it, never a hardcoded list.
export interface ImportTemplateSummary {
  entity: string
  columns: string[]
  example_rows: number
  url: string
}

// GET /imports/templates — needs customers.view (route middleware).
export async function fetchImportTemplates(signal?: AbortSignal): Promise<ImportTemplateSummary[]> {
  const res = await api.get('/imports/templates', { signal })
  return unwrap<ImportTemplateSummary[]>(res) ?? []
}

// Per-row outcome, keyed by the file's own line number (ImportRunner::run) so a user
// fixes "row 47" — the same number they see in Excel — never a 0-based array index.
export type ImportRowAction = 'create' | 'update' | 'skip' | 'error'

export interface ImportRowResult {
  row: number
  action: ImportRowAction
  reference: string | null
  id: string | null
  messages: string[]
}

export interface ImportSummary {
  rows: number
  create: number
  update: number
  skip: number
  error: number
}

// The one response shape shared by both the dry run and the real run
// (ImportRunner::run) — dry_run tells the caller which of the two it is looking at.
export interface ImportRunResult {
  entity: string
  dry_run: boolean
  summary: ImportSummary
  unknown_columns: string[]
  rows: ImportRowResult[]
}

// Parse the filename the backend sets via Content-Disposition. Mirrors
// ExportSettings.jsx's own parseFilename/downloadCsv — duplicated rather than
// imported because this task's scope is limited to the Importeren files; a later
// pass could extract both into one shared lib/downloadBlob.ts.
function parseFilename(header?: string | null): string | null {
  if (!header) return null
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(header)
  return match ? decodeURIComponent(match[1]) : null
}

// GET /imports/{entity}/template.csv — a filled-in example file, no tenant data at
// all. Needs customers.view. Streams via a temporary object URL through the shared
// axios client (cookie + CSRF already attached), never a bare <a href> navigation.
export async function downloadImportTemplate(entity: string): Promise<void> {
  const res = await api.get(`/imports/${entity}/template.csv`, { responseType: 'blob' })
  const filename = parseFilename(res.headers?.['content-disposition']) ?? `import-voorbeeld-${entity}.csv`
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Both the preview and the real run post the SAME multipart shape — the field name
// MUST be "file" (ImportUploadRequest::rules), never a JSON body.
function buildUploadForm(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

// POST /imports/{entity}/dry-run — previews every row, writes nothing. Needs
// customers.create: an import IS a bulk create, the same right the real run needs.
export async function dryRunImport(entity: string, file: File): Promise<ImportRunResult> {
  const res = await api.post(`/imports/${entity}/dry-run`, buildUploadForm(file))
  return unwrap<ImportRunResult>(res)
}

// POST /imports/{entity} — the real run, transactional per row and idempotent.
export async function runImport(entity: string, file: File): Promise<ImportRunResult> {
  const res = await api.post(`/imports/${entity}`, buildUploadForm(file))
  return unwrap<ImportRunResult>(res)
}
