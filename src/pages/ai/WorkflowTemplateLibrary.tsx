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
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { useWorkflowTemplates, KOIOS_AI_CATEGORY } from './hooks/useWorkflowTemplates'
import type { WorkflowTemplate } from './hooks/useWorkflowTemplates'
import Button from '@/components/ui/Button'

interface WorkflowTemplateLibraryProps {
  open: boolean
  onClose: () => void
  onUseTemplate: (template: WorkflowTemplate) => void
}

// The category state is `string | null` ("All templates"); SegmentedControl needs a
// real string value for every option, so "All" gets its own sentinel value.
const ALL_CATEGORY = '__all__'

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
      <Button variant="primary" size="sm" onClick={onUse} aria-label={`${useLabel} — ${template.name}`}
        style={{ alignSelf: 'flex-start' }}>
        {useLabel}
      </Button>
    </div>
  )
}

export default function WorkflowTemplateLibrary({ open, onClose, onUseTemplate }: WorkflowTemplateLibraryProps) {
  const { t } = useTranslation('workflows')
  const { templates, category, setCategory, loading, error } = useWorkflowTemplates(open)

  // Categories other than Koios AI, derived from whatever the last fetch carried —
  // Koios AI itself is always pinned in the bar regardless of what loaded.
  const otherCategories = useMemo(() => {
    const set = new Set<string>()
    templates.forEach((tpl) => { if (tpl.category && tpl.category !== KOIOS_AI_CATEGORY) set.add(tpl.category) })
    return [...set].sort()
  }, [templates])

  // HUISSTIJL-1: the hand-rolled aria-pressed CategoryRow list is now the shared
  // SegmentedControl (compact — a horizontal pill row, mirroring ReportSwitchBar/
  // KoiosForYouCard's period switches). "All templates" needs a real string value
  // since the underlying state uses `null` for that case.
  const categoryOptions = useMemo(() => [
    { value: ALL_CATEGORY, label: t('templateLibrary.allTemplates') },
    // The brand mark rides along again now compact SegmentedControl renders
    // option icons (Opus batch C finding 4: grow the shared component, never
    // shrink the brand).
    { value: KOIOS_AI_CATEGORY, label: t('templateLibrary.koiosAiFolder'), icon: KoiosAiMark },
    ...otherCategories.map(cat => ({ value: cat, label: cat })),
  ], [otherCategories, t])
  const handleCategoryChange = (value: string) => setCategory(value === ALL_CATEGORY ? null : value)

  return (
    <FloatingPanel open={open} onClose={onClose} ariaLabel={t('templateLibrary.title')}
      persistKey="workflow-template-library" width="min(880px, 94vw)" scrollBody={false}
      header={
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('templateLibrary.title')}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('templateLibrary.subtitle')}</div>
        </div>
      }>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Category bar — "All templates" + the pinned Koios AI folder + whatever else
            loaded. Horizontal-scrolls instead of wrapping if a tenant has many categories. */}
        <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 16px', overflowX: 'auto' }}>
          <SegmentedControl options={categoryOptions} value={category ?? ALL_CATEGORY} onChange={handleCategoryChange}
            size="compact" ariaLabel={t('templateLibrary.title')} />
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
