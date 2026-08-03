/**
 * useMappingWizard — state for the wizard's PRE-VALIDATION steps: parse the uploaded
 * file client-side, auto-map its columns, and keep the editable preview rows in sync
 * with both the mapping and any manual cell edit. The actual dry-run/run calls stay
 * owned by the existing `useImportWizard` hook (settings/sections/importeren) —
 * this hook only ever hands it a freshly built File (api.ts buildImportFile).
 *
 * `dirty` is the honest-preview guard: true whenever the editable rows changed since
 * the last SUCCESSFUL validate, so the container can gate the real import behind a
 * fresh dry-run of exactly what is about to be sent (never a stale one).
 */
import { useCallback, useState } from 'react'
import { readCsvFile } from '../lib/csv'
import { autoMapColumns, buildMappedRows, setMapping, type ColumnMapping } from '../lib/mapping'

export type MappingWizardStep = 'upload' | 'map' | 'preview'

interface MappingWizardState {
  step: MappingWizardStep
  fileName: string | null
  headers: string[]
  sourceRows: string[][]
  mapping: ColumnMapping
  editableRows: Array<Record<string, string>>
  dirty: boolean
}

const INITIAL_STATE: MappingWizardState = {
  step: 'upload', fileName: null, headers: [], sourceRows: [], mapping: {}, editableRows: [], dirty: false,
}

export function useMappingWizard(targetColumns: readonly string[]) {
  const [state, setState] = useState<MappingWizardState>(INITIAL_STATE)

  // Step 1 -> 2: parse the file client-side and suggest a mapping. Nothing is sent
  // to the server yet — that only happens once the user validates the preview.
  const loadFile = useCallback(async (file: File) => {
    const parsed = await readCsvFile(file)
    const mapping = autoMapColumns(parsed.headers, targetColumns)
    const editableRows = buildMappedRows(parsed.headers, parsed.rows, mapping)
    setState({ step: 'map', fileName: file.name, headers: parsed.headers, sourceRows: parsed.rows, mapping, editableRows, dirty: true })
  }, [targetColumns])

  // A manual override in the mapping step rebuilds the preview rows from the RAW
  // parsed data — remapping a column supersedes whatever it produced before.
  const updateMapping = useCallback((sourceHeader: string, target: string) => {
    setState((s) => {
      const mapping = setMapping(s.mapping, sourceHeader, target)
      const editableRows = buildMappedRows(s.headers, s.sourceRows, mapping)
      return { ...s, mapping, editableRows, dirty: true }
    })
  }, [])

  const goToPreview = useCallback(() => setState((s) => ({ ...s, step: 'preview' })), [])
  const backToMapping = useCallback(() => setState((s) => ({ ...s, step: 'map' })), [])

  // A cell edit in the preview table — invalidates the last validate (dirty=true).
  const editCell = useCallback((rowIndex: number, column: string, value: string) => {
    setState((s) => ({
      ...s,
      editableRows: s.editableRows.map((row, i) => (i === rowIndex ? { ...row, [column]: value } : row)),
      dirty: true,
    }))
  }, [])

  // Called by the container right after a dry-run succeeds for the CURRENT rows.
  const markValidated = useCallback(() => setState((s) => ({ ...s, dirty: false })), [])

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  return { ...state, loadFile, updateMapping, goToPreview, backToMapping, editCell, markValidated, reset }
}
