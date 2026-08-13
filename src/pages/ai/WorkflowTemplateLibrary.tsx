/**
 * WorkflowTemplateLibrary — the template gallery for starting a new workflow
 * (K0): browse templates by category, with a distinct "Koios AI" folder for the
 * six seeded action templates (WhatsApp · e-mail · task · appointment ·
 * notification · call-list). Thin container (§3A): all data comes from
 * useWorkflowTemplates; picking a template only hands it to the caller via
 * `onUseTemplate` — turning a template into a saved workflow is the caller's
 * concern (mirrors how WorkflowsPage owns handleSave, not its list panels).
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import { useWorkflowTemplates, KOIOS_AI_CATEGORY } from './hooks/useWorkflowTemplates'
import type { WorkflowTemplate } from './hooks/useWorkflowTemplates'

interface WorkflowTemplateLibraryProps {
  open: boolean
  onClose: () => void
  onUseTemplate: (template: WorkflowTemplate) => void
}

// One row in the category sidebar (built-in "All"/"Koios AI" or a template's own
// category). The icon is aria-hidden — the visible label already fully names the
// button, so KoiosAiMark's own "Koios AI" aria-label doesn't get glued onto it.
function CategoryRow({ active, label, icon, onClick }: { active: boolean; label: string; icon?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
        padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', marginBottom: 2,
        background: active ? 'var(--color-primary-bg)' : 'transparent',
        // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
        color: active ? 'var(--color-primary-text)' : 'var(--text)', fontSize: 13, fontWeight: active ? 600 : 400,
      }}>
      {icon && <span aria-hidden="true" style={{ display: 'flex' }}>{icon}</span>}
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  )
}

// One template tile — name/description + a "Use template" action the caller wires
// up. The button's own accessible name includes the template name (not just the
// generic verb) so multiple cards stay distinguishable to assistive tech too.
function TemplateCard({ template, useLabel, onUse }: { template: WorkflowTemplate; useLabel: string; onUse: () => void }) {
  const isKoiosAi = template.category === KOIOS_AI_CATEGORY
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isKoiosAi && <KoiosAiMark size={20} />}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{template.name}</div>
      </div>
      {template.description && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, flex: 1 }}>{template.description}</p>
      )}
      {/* CONTRAST-YELLOW-1 (08-08 audit): the fill IS the tenant accent, so the label
          must use the computed on-accent token — a hardcoded white reads as 1.31:1
          against a yellow brand instead of the intended readable contrast. */}
      <button type="button" onClick={onUse} aria-label={`${useLabel} — ${template.name}`}
        style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-on-accent)',
                 background: 'var(--color-primary)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        {useLabel}
      </button>
    </div>
  )
}

export default function WorkflowTemplateLibrary({ open, onClose, onUseTemplate }: WorkflowTemplateLibraryProps) {
  const { t } = useTranslation('workflows')
  const { templates, category, setCategory, loading, error } = useWorkflowTemplates(open)

  // Categories other than Koios AI, derived from whatever the last fetch carried —
  // Koios AI itself is always pinned in the sidebar regardless of what loaded.
  const otherCategories = useMemo(() => {
    const set = new Set<string>()
    templates.forEach((tpl) => { if (tpl.category && tpl.category !== KOIOS_AI_CATEGORY) set.add(tpl.category) })
    return [...set].sort()
  }, [templates])

  return (
    <FloatingPanel open={open} onClose={onClose} ariaLabel={t('templateLibrary.title')}
      persistKey="workflow-template-library" width="min(880px, 94vw)" scrollBody={false}
      header={
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('templateLibrary.title')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('templateLibrary.subtitle')}</div>
        </div>
      }>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Category sidebar — "All templates" + the pinned Koios AI folder + whatever else loaded. */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: 8 }}>
          <CategoryRow active={category === null} label={t('templateLibrary.allTemplates')} onClick={() => setCategory(null)} />
          <CategoryRow active={category === KOIOS_AI_CATEGORY} onClick={() => setCategory(KOIOS_AI_CATEGORY)}
            icon={<KoiosAiMark size={18} />} label={t('templateLibrary.koiosAiFolder')} />
          {otherCategories.map((cat) => (
            <CategoryRow key={cat} active={category === cat} label={cat} onClick={() => setCategory(cat)} />
          ))}
        </div>

        {/* Template grid for the selected category. */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          {category === KOIOS_AI_CATEGORY && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 12 }}>{t('templateLibrary.koiosAiHint')}</p>
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              <Loader2 size={14} className="animate-spin" /> {t('templateLibrary.loading')}
            </div>
          )}
          {!loading && error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{t('templateLibrary.error')}</p>}
          {!loading && !error && templates.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('templateLibrary.empty')}</p>
          )}
          {!loading && !error && templates.length > 0 && (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {templates.map((tpl) => (
                <TemplateCard key={tpl.id} template={tpl} useLabel={t('templateLibrary.useTemplate')} onUse={() => onUseTemplate(tpl)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </FloatingPanel>
  )
}
