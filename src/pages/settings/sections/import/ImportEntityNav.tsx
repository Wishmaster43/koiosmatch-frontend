/**
 * ImportEntityNav — the left sub-nav of the import wizard: every template
 * GET /imports/templates returns, split into the two REAL choices a user has —
 * one file that builds a whole new customer, or the four single-entity files that
 * extend a customer that already exists (importTemplateShape).
 *
 * The split exists because hiding one of the two is what makes people run both for
 * the same data. Group headings only appear once there is something to choose
 * between; with a single group the list stays a plain list.
 */
import { useTranslation } from 'react-i18next'
import { groupTemplates } from './importTemplateShape'
import { iconForTemplate } from './importEntityIcon'
import type { ImportTemplateSummary } from './importApi'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import SubNavButton from '@/pages/settings/components/SubNavButton'

interface ImportEntityNavProps {
  templates: ImportTemplateSummary[]
  phase: 'loading' | 'ready' | 'error'
  selected: string | null
  onSelect: (entity: string) => void
  onReload: () => void
}

// Splits import templates into whole-tree vs per-entity groups, so the two real choices stay visible instead of one hiding behind the other (see file header).
export default function ImportEntityNav({ templates, phase, selected, onSelect, onReload }: ImportEntityNavProps) {
  const { t } = useTranslation('settings')
  const { wholeTree, perEntity } = groupTemplates(templates)
  // Headings only earn their space when both paths actually exist.
  const showHeadings = wholeTree.length > 0 && perEntity.length > 0

  // One nav button — the shared SubNavButton, so this and ExportSettings never drift apart.
  const renderTemplate = (tpl: ImportTemplateSummary) => {
    const Icon = iconForTemplate(tpl)
    const active = tpl.entity === selected
    return (
      <SubNavButton key={tpl.entity} icon={Icon} active={active} ariaCurrent={active}
        onClick={() => onSelect(tpl.entity)}
        label={t(`import.entities.${tpl.entity}.label`, { defaultValue: tpl.entity })} />
    )
  }

  // One group heading — the shared GroupLabel atom (§4), only padding is local layout.
  const renderHeading = (key: string) => (
    <GroupLabel style={{ padding: '10px 10px 4px' }}>{t(key)}</GroupLabel>
  )

  return (
    <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', paddingRight: 16, marginRight: 32 }}>
      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px' }}>
          <Spinner size={13} /> {t('import.loadingTemplates')}
        </div>
      )}
      {phase === 'error' && (
        <div style={{ padding: '8px 10px' }}>
          <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginBottom: 8 }}>{t('import.loadTemplatesError')}</p>
          {/* HUISSTIJL-1: the retry action is a real Button (ghostAccent), never a hand-painted link-button. */}
          <Button variant="ghostAccent" onClick={onReload} style={{ padding: 0, height: 'auto' }}>
            {t('common:error.retry')}
          </Button>
        </div>
      )}
      {phase === 'ready' && templates.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px' }}>{t('import.noTemplates')}</p>
      )}
      {phase === 'ready' && templates.length > 0 && (
        <>
          {wholeTree.length > 0 && (
            <>
              {showHeadings && renderHeading('import.groups.wholeTree')}
              {wholeTree.map(renderTemplate)}
            </>
          )}
          {perEntity.length > 0 && (
            <>
              {showHeadings && renderHeading('import.groups.perEntity')}
              {perEntity.map(renderTemplate)}
            </>
          )}
        </>
      )}
    </div>
  )
}
