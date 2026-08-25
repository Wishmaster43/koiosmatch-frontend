/**
 * ImportWizardPage — the full-screen import wizard Danny asked for ("een nieuw
 * scherm... soort wizard: dat je data ziet, velden worden gekoppeld en je kan
 * eventueel nog wat aanpassen" — "a new screen... a kind of wizard: where you
 * see the data, fields get matched and you can optionally still adjust
 * something"): upload -> match columns -> editable preview ->
 * confirm -> result. Reachable at #import-wizard (see appPages.tsx).
 *
 * Thin route page: entity list + permission checks live here; the actual per-step
 * flow is EntityImportWizard, remounted (key={entity}) on every entity switch so a
 * stale file/mapping never survives a switch. The entity nav, banners and result
 * panel are the SAME components the settings "importeren" screen already uses
 * (§3A reuse) — this screen adds the column-mapping + editable-preview steps that
 * screen does not have; it does not reinvent what already works.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ImportEntityNav } from '@/pages/settings/shared'
import { useImportTemplates } from '@/pages/settings/shared'
import { groupTemplates, importPermissionsFor, orderedTemplates } from '@/pages/settings/shared'
import type { ImportTemplateSummary } from './api'
import EntityImportWizard from './EntityImportWizard'

interface ImportWizardPageProps {
  // PDF-VACATURES-2026-08-14 point 7: a caller (the vacancies toolbar's Excel-
  // upload button) can preselect an entity via `{ entity: 'vacancies' }` so the
  // wizard lands there instead of the first template in display order.
  intent?: { entity?: string } | null
}

export default function ImportWizardPage({ intent }: ImportWizardPageProps = {}) {
  const { t } = useTranslation('settings')
  // Auth context can be null pre-boot — an honest fallback, mirrors ImporterenSettings.tsx.
  const hasPermission = useAuth()?.hasPermission ?? (() => false)
  const { templates, phase, reload } = useImportTemplates()
  const [selected, setSelected] = useState<string | null>(null)

  // Land on the requested entity (if its template exists) or the first template in
  // display order (the combined file first when the backend serves one); never
  // overrides a user's own pick once one has been made.
  useEffect(() => {
    if (phase === 'ready' && templates.length > 0 && !selected) {
      const wanted = intent?.entity && templates.some(tpl => tpl.entity === intent.entity) ? intent.entity : null
      setSelected(wanted ?? orderedTemplates(templates)[0]?.entity ?? null)
    }
  }, [phase, templates, selected, intent])

  // Gated on the SELECTED entity's own permission pair (importPermissionsFor mirrors
  // exports.php): vacancies needs vacancies.view/create, every other entity (a
  // customer-tree sub-entity) needs customers.view/create. Previously hardcoded to
  // the customers pair regardless of selection — a fake affordance for a user with
  // e.g. vacancies.create but not customers.create.
  const permissions = importPermissionsFor(selected)
  const canView = hasPermission(permissions.view)
  const canImport = hasPermission(permissions.create)

  const selectedTemplate: ImportTemplateSummary | undefined = templates.find((tpl) => tpl.entity === selected)
  const groups = groupTemplates(templates)
  const wholeTree = groups.wholeTree.some((tpl) => tpl.entity === selected)
  const otherPathEntity = (wholeTree ? groups.perEntity[0]?.entity : groups.wholeTree[0]?.entity) ?? null

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('import.title')}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('import.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 0, minHeight: 400 }}>
        <ImportEntityNav templates={templates} phase={phase} selected={selected} onSelect={setSelected} onReload={reload} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {phase === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-danger-text)', fontSize: 13 }}>
              <AlertTriangle size={14} /> {t('import.loadTemplatesError')}
            </div>
          )}
          {phase === 'ready' && !selectedTemplate && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('import.noTemplates')}</p>
          )}
          {phase === 'ready' && selectedTemplate && (
            <EntityImportWizard key={selectedTemplate.entity} template={selectedTemplate}
              otherPathEntity={otherPathEntity} onSelectEntity={setSelected}
              canView={canView} canImport={canImport} />
          )}
        </div>
      </div>
    </div>
  )
}
