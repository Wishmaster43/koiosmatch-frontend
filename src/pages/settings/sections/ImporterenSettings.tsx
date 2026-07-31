/**
 * ImporterenSettings — the real CSV import wizard (replaces a mockup that made zero
 * API calls and told tenants their data was imported when nothing had happened —
 * verified: no `api.`/`fetch(`/`axios` anywhere in the old file). Entities come from
 * GET /imports/templates (never hardcoded); the flow is always
 * upload -> mandatory dry-run preview -> confirm -> real result, never a shortcut.
 * Layout mirrors ExportSettings.jsx (left entity sub-nav + right content card) — the
 * two data-exchange screens share one master-detail format (Danny 21-07).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building, Building2, FileSpreadsheet, Loader2, MapPin, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useImportTemplates } from './importeren/useImportTemplates'
import { useImportWizard } from './importeren/useImportWizard'
import ImportOrderBanner from './importeren/ImportOrderBanner'
import UploadStep from './importeren/UploadStep'
import PreviewStep from './importeren/PreviewStep'
import ResultStep from './importeren/ResultStep'
import type { ImportTemplateSummary } from './importeren/importApi'

// UI-only icon per known entity. A future entity the backend adds falls back to a
// generic icon — the ENTITY LIST ITSELF always comes from the API, never from here.
const ENTITY_ICONS: Record<string, typeof Building2> = {
  customers: Building2,
  locations: MapPin,
  departments: Building,
  contacts: Users,
}

interface EntityWizardProps {
  entity: string
  canView: boolean
  canImport: boolean
}

// The wizard body for the currently selected entity. The parent renders this with
// `key={entity}` so switching entities remounts fresh hook state instead of
// carrying over a stale file or preview from the previous selection.
function EntityWizard({ entity, canView, canImport }: EntityWizardProps) {
  const wizard = useImportWizard(entity)

  return (
    <>
      <ImportOrderBanner entity={entity} />
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
            onConfirm={wizard.confirmImport}
            onBack={wizard.backToUpload}
          />
        )}
        {wizard.step === 'result' && wizard.run.status === 'success' && (
          <ResultStep result={wizard.run.result} onReset={wizard.reset} />
        )}
      </div>
    </>
  )
}

export default function ImporterenSettings() {
  const { t } = useTranslation('settings')
  // Auth context can be null pre-boot (mirrors CustomersBulkBar's own fallback).
  const hasPermission = useAuth()?.hasPermission ?? (() => false)
  const { templates, phase, reload } = useImportTemplates()
  const [selected, setSelected] = useState<string | null>(null)

  // Land on the first template once the list arrives; never overrides a user pick.
  useEffect(() => {
    if (phase === 'ready' && templates.length > 0 && !selected) setSelected(templates[0].entity)
  }, [phase, templates, selected])

  // Same permission pair for every entity here: locations/departments/contacts are
  // sub-entities of the customer tree and share its rights (routes/api/tenant/exports.php).
  const canView = hasPermission('customers.view')
  const canImport = hasPermission('customers.create')

  const selectedTemplate: ImportTemplateSummary | undefined = templates.find((tpl) => tpl.entity === selected)

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
      {/* Sub-nav — one entity per row, fetched from the API (never hardcoded). */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', paddingRight: 16, marginRight: 32 }}>
        {phase === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px' }}>
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> {t('import.loadingTemplates')}
          </div>
        )}
        {phase === 'error' && (
          <div style={{ padding: '8px 10px' }}>
            <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 8 }}>{t('import.loadTemplatesError')}</p>
            <button type="button" onClick={reload}
              style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {t('common:error.retry')}
            </button>
          </div>
        )}
        {phase === 'ready' && templates.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px' }}>{t('import.noTemplates')}</p>
        )}
        {phase === 'ready' && templates.map((tpl) => {
          const Icon = ENTITY_ICONS[tpl.entity] ?? FileSpreadsheet
          const active = tpl.entity === selected
          return (
            <button key={tpl.entity} onClick={() => setSelected(tpl.entity)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                       borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                       fontWeight: active ? 600 : 400, marginBottom: 2,
                       background: active ? 'var(--color-primary-bg)' : 'transparent',
                       color: active ? 'var(--color-primary)' : 'var(--text)' }}>
              <Icon size={14} style={{ color: active ? 'var(--color-primary)' : 'var(--text-muted)' }} />
              {t(`import.entities.${tpl.entity}.label`, { defaultValue: tpl.entity })}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('import.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('import.subtitle')}</p>
        </div>

        {phase === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger)', fontSize: 13 }}>
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
                const Icon = ENTITY_ICONS[selectedTemplate.entity] ?? FileSpreadsheet
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
            <EntityWizard key={selectedTemplate.entity} entity={selectedTemplate.entity} canView={canView} canImport={canImport} />
          </>
        )}
      </div>
    </div>
  )
}
