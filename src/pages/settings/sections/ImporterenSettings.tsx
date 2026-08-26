/**
 * ImporterenSettings — the real CSV import wizard (replaces a mockup that made zero
 * API calls and told tenants their data was imported when nothing had happened —
 * verified: no `api.`/`fetch(`/`axios` anywhere in the old file). Entities come from
 * GET /imports/templates (never hardcoded); the flow is always
 * upload -> mandatory dry-run preview -> confirm -> real result, never a shortcut.
 * Layout mirrors ExportSettings.jsx (left entity sub-nav + right content card) — the
 * two data-exchange screens share one master-detail format (Danny 21-07).
 *
 * IMPORT-TREE-1: the backend now also serves a COMBINED whole-customer template
 * (CustomerTreeImporter) that builds customer + location + department + contact from
 * one flat file. It arrives through the same templates endpoint, so no plumbing was
 * needed — what it needed is the EXPLANATION: which of the two paths a user is on,
 * that the combined file replaces the four-step order rather than adding to it, and
 * that the four separate files stay the right tool for extending a customer that
 * already exists (ImportEntityNav + WholeTreeBanner/ImportOrderBanner).
 *
 * IMPORT-WIZARD-1: this screen's own flow has no column-mapping or editable-preview
 * step — it expects the file's headers to already match the template exactly. For a
 * file that needs its columns matched or a cell adjusted before sending, this screen
 * now links to the full-screen wizard (src/pages/import/, #import-wizard) that adds
 * exactly that on top, reusing this screen's own ImportEntityNav/banners/ResultStep
 * rather than duplicating them. Both stay: neither is a mockup of the other.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNavigation } from '@/context/NavigationContext'
import { useImportTemplates } from './importeren/useImportTemplates'
import { useImportWizard } from './importeren/useImportWizard'
import ImportEntityNav from './importeren/ImportEntityNav'
import ImportOrderBanner from './importeren/ImportOrderBanner'
import WholeTreeBanner from './importeren/WholeTreeBanner'
import UploadStep from './importeren/UploadStep'
import PreviewStep from './importeren/PreviewStep'
import ResultStep from './importeren/ResultStep'
import { groupTemplates, importPermissionsFor, isWholeTreeTemplate, orderedTemplates } from './importeren/importTemplateShape'
import { iconForTemplate } from './importeren/importEntityIcon'
import type { ImportTemplateSummary } from './importeren/importApi'
import { PageTitle } from '@/components/ui/typography'

interface EntityWizardProps {
  entity: string
  wholeTree: boolean
  /** The template to offer as the OTHER path, or null when there is only one. */
  otherPathEntity: string | null
  onSelectEntity: (entity: string) => void
  canView: boolean
  canImport: boolean
}

// The wizard body for the currently selected entity. The parent renders this with
// `key={entity}` so switching entities remounts fresh hook state instead of
// carrying over a stale file or preview from the previous selection.
function EntityWizard({ entity, wholeTree, otherPathEntity, onSelectEntity, canView, canImport }: EntityWizardProps) {
  const wizard = useImportWizard(entity)

  return (
    <>
      {/* Two files, two rules: the combined file has no import order at all, the four
          separate ones live or die by it. Showing the wrong banner would be a lie. */}
      {wholeTree
        ? <WholeTreeBanner separateEntity={otherPathEntity} onSelectEntity={onSelectEntity} />
        : <ImportOrderBanner entity={entity} wholeTreeEntity={otherPathEntity} onSelectEntity={onSelectEntity} />}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        {wizard.step === 'upload' && (
          <UploadStep
            entity={entity}
            file={wizard.file}
            onSelectFile={wizard.selectFile}
            onRunPreview={wizard.runPreview}
            previewStatus={wizard.preview.status}
            previewError={wizard.preview.status === 'error' ? wizard.preview.message : undefined}
            canView={canView}
            canImport={canImport}
          />
        )}
        {wizard.step === 'preview' && wizard.preview.status === 'success' && (
          <PreviewStep
            result={wizard.preview.result}
            runStatus={wizard.run.status}
            runError={wizard.run.status === 'error' ? wizard.run.message : undefined}
            canImport={canImport}
            wholeTree={wholeTree}
            onConfirm={wizard.confirmImport}
            onBack={wizard.backToUpload}
          />
        )}
        {wizard.step === 'result' && wizard.run.status === 'success' && (
          <ResultStep result={wizard.run.result} wholeTree={wholeTree} onReset={wizard.reset} />
        )}
      </div>
    </>
  )
}

// Settings screen driving the shared import wizard through upload/preview/confirm/result steps.
export default function ImporterenSettings() {
  const { t } = useTranslation('settings')
  // Auth context can be null pre-boot (mirrors CustomersBulkBar's own fallback).
  const hasPermission = useAuth()?.hasPermission ?? (() => false)
  // IMPORT-WIZARD-1: jumps to the full-screen wizard (#import-wizard) that adds
  // column mapping + an editable preview on top of this screen's own dry-run flow.
  const { navigate } = useNavigation()
  const { templates, phase, reload } = useImportTemplates()
  const [selected, setSelected] = useState<string | null>(null)

  // Land on the first template in DISPLAY order — the combined whole-customer file
  // when the backend serves one, since that is the answer for a new customer; never
  // overrides a user pick.
  useEffect(() => {
    if (phase === 'ready' && templates.length > 0 && !selected) {
      setSelected(orderedTemplates(templates)[0]?.entity ?? null)
    }
  }, [phase, templates, selected])

  // Gated on the SELECTED entity's own permission pair (importPermissionsFor mirrors
  // exports.php): vacancies needs vacancies.view/create, every other entity (a
  // customer-tree sub-entity) needs customers.view/create. Previously hardcoded to
  // the customers pair regardless of selection — a fake affordance for a user with
  // e.g. vacancies.create but not customers.create.
  const permissions = importPermissionsFor(selected)
  const canView = hasPermission(permissions.view)
  const canImport = hasPermission(permissions.create)

  const selectedTemplate: ImportTemplateSummary | undefined = templates.find((tpl) => tpl.entity === selected)
  const wholeTree = selectedTemplate ? isWholeTreeTemplate(selectedTemplate.columns) : false
  const groups = groupTemplates(templates)
  // The OTHER path to offer from the banner: the combined file while on a separate
  // one, and the first separate file while on the combined one.
  const otherPathEntity = (wholeTree ? groups.perEntity[0]?.entity : groups.wholeTree[0]?.entity) ?? null

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      <ImportEntityNav templates={templates} phase={phase} selected={selected} onSelect={setSelected} onReload={reload} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <PageTitle>{t('import.title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('import.subtitle')}</p>
        </div>

        {/* IMPORT-WIZARD-1: a real link (never a fake affordance) to the full-screen
            wizard — column mapping + an editable preview, which this quicker screen
            does not offer. Both stay: this one for a client whose file already uses
            the exact column names, the wizard for one that needs mapping/adjusting. */}
        <button type="button" onClick={() => navigate('import-wizard')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, padding: '10px 14px',
                   background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
                   border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
                   borderRadius: 8, fontSize: 12, color: 'var(--color-primary-text)', cursor: 'pointer', width: '100%',
                   textAlign: 'left' }}>
          <span style={{ flex: 1, color: 'var(--text)' }}>
            {t('import.wizard.linkFromSettings', {
              ns: 'settings',
              defaultValue: 'Prefer a guided, step-by-step import with column matching and an editable preview?',
            })}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, flexShrink: 0 }}>
            {t('import.wizard.linkFromSettingsCta', { ns: 'settings' })}
            <ArrowRight size={13} aria-hidden="true" />
          </span>
        </button>

        {phase === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger-text)', fontSize: 13 }}>
            <AlertTriangle size={14} /> {t('import.loadTemplatesError')}
          </div>
        )}
        {phase === 'ready' && !selectedTemplate && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('import.noTemplates')}</p>
        )}
        {phase === 'ready' && selectedTemplate && (
          <>
            {/* Entity heading inside the card area — mirrors ExportSettings' own
                icon + title + description row for the selected entity. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              {(() => {
                const Icon = iconForTemplate(selectedTemplate)
                return <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
              })()}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {t(`import.entities.${selectedTemplate.entity}.label`, { defaultValue: selectedTemplate.entity })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t(`import.entities.${selectedTemplate.entity}.desc`, { defaultValue: '' })}
                </div>
              </div>
            </div>
            <EntityWizard key={selectedTemplate.entity} entity={selectedTemplate.entity} wholeTree={wholeTree}
              otherPathEntity={otherPathEntity} onSelectEntity={setSelected}
              canView={canView} canImport={canImport} />
          </>
        )}
      </div>
    </div>
  )
}
