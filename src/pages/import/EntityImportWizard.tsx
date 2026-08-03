/**
 * EntityImportWizard — thin per-entity container: local parse/map/edit state
 * (useMappingWizard) + the dry-run/run calls (useValidateAndRun) + which step
 * component to render. Remounted (key={entity}) by ImportWizardPage on every entity
 * switch, so switching entities never carries over a stale file/mapping/preview —
 * mirrors the same `key`-remount contract settings/importeren/ImporterenSettings.tsx
 * already uses for its own EntityWizard.
 */
import { useCallback } from 'react'
import ImportOrderBanner from '@/pages/settings/sections/importeren/ImportOrderBanner'
import WholeTreeBanner from '@/pages/settings/sections/importeren/WholeTreeBanner'
import ResultStep from '@/pages/settings/sections/importeren/ResultStep'
import { isWholeTreeTemplate } from '@/pages/settings/sections/importeren/importTemplateShape'
import { buildImportFile, type ImportTemplateSummary } from './api'
import { useMappingWizard } from './hooks/useMappingWizard'
import { useValidateAndRun } from './hooks/useValidateAndRun'
import UploadStep from './steps/UploadStep'
import MapColumnsStep from './steps/MapColumnsStep'
import PreviewEditStep from './steps/PreviewEditStep'

interface EntityImportWizardProps {
  template: ImportTemplateSummary
  /** The other import path to offer from the banner (see ImporterenSettings.tsx). */
  otherPathEntity: string | null
  onSelectEntity: (entity: string) => void
  canView: boolean
  canImport: boolean
}

export default function EntityImportWizard({ template, otherPathEntity, onSelectEntity, canView, canImport }: EntityImportWizardProps) {
  const entity = template.entity
  const wholeTree = isWholeTreeTemplate(template.columns)
  const mappingWizard = useMappingWizard(template.columns)
  const { preview, run, validate, confirm, reset: resetRun } = useValidateAndRun(entity)

  // Build the CSV from the CURRENT mapped+edited rows and dry-run it. Marking the
  // rows "validated" only happens on success, so a failed dry-run correctly leaves
  // `dirty` alone (nothing to re-validate against, the rows never changed).
  // Deps deliberately scoped to the fields actually read, not the whole mappingWizard
  // object below — that object is a fresh literal every render (useMappingWizard
  // spreads state each call), so listing it would defeat the memoization entirely.
  const handleValidate = useCallback(() => {
    const file = buildImportFile(entity, template.columns, mappingWizard.editableRows)
    void validate(file).then((ok) => { if (ok) mappingWizard.markValidated() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, template.columns, mappingWizard.editableRows, mappingWizard.markValidated, validate])

  // The real import — only reachable once PreviewEditStep has hidden this behind a
  // successful, non-stale validate (its own `!dirty` gate). Same scoping as above.
  const handleConfirm = useCallback(() => {
    const file = buildImportFile(entity, template.columns, mappingWizard.editableRows)
    void confirm(file)
  }, [entity, template.columns, mappingWizard.editableRows, confirm])

  // Same scoping as handleValidate above.
  const handleReset = useCallback(() => {
    mappingWizard.reset()
    resetRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappingWizard.reset, resetRun])

  return (
    <>
      {wholeTree
        ? <WholeTreeBanner separateEntity={otherPathEntity} onSelectEntity={onSelectEntity} />
        : <ImportOrderBanner entity={entity} wholeTreeEntity={otherPathEntity} onSelectEntity={onSelectEntity} />}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        {run.status === 'success' ? (
          <ResultStep result={run.result} wholeTree={wholeTree} onReset={handleReset} />
        ) : mappingWizard.step === 'upload' ? (
          <UploadStep entity={entity} canView={canView} canImport={canImport} onFileReady={mappingWizard.loadFile} />
        ) : mappingWizard.step === 'map' ? (
          <MapColumnsStep entity={entity} headers={mappingWizard.headers} targetColumns={template.columns}
            mapping={mappingWizard.mapping} onChangeMapping={mappingWizard.updateMapping}
            onNext={mappingWizard.goToPreview} onBack={mappingWizard.reset} />
        ) : (
          <PreviewEditStep entity={entity} targetColumns={template.columns} mapping={mappingWizard.mapping}
            editableRows={mappingWizard.editableRows} dirty={mappingWizard.dirty} onEditCell={mappingWizard.editCell}
            onValidate={handleValidate} previewStatus={preview.status}
            previewError={preview.status === 'error' ? preview.message : undefined}
            previewResult={preview.status === 'success' ? preview.result : undefined}
            runStatus={run.status} runError={run.status === 'error' ? run.message : undefined}
            canImport={canImport} wholeTree={wholeTree} onConfirm={handleConfirm} onBackToMapping={mappingWizard.backToMapping} />
        )}
      </div>
    </>
  )
}
