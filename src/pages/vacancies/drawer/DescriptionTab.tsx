import type { ComponentType, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2, ExternalLink } from 'lucide-react'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import Button from '@/components/ui/Button'
// HUISSTIJL-1: the group label (11/600/uppercase/muted) is the shared GroupLabel atom.
import { GroupLabel } from '@/components/ui/typography'
import { useVacancyDescription } from '../hooks/useVacancyDescription'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }

/**
 * DescriptionTab — the vacancy description as its OWN drawer main-tab (Danny
 * 21-07: split out of DetailsTab's Profiel sub-tab so it reads as a standalone
 * section, mirroring the candidate profile text). Same rich editor, "Genereer
 * met Koios" flow, and its own independent pencil/save/cancel toggle as before —
 * only the state now lives in useVacancyDescription instead of the field-grid hook.
 *
 * A vacancy description is a description of the role, not a conversation, so
 * it never opts into "Actiepunten" — it rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed.
 */
export default function DescriptionTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const {
    descEditing, setDescEditing, descExpanded, setDescExpanded, description, setDescription, saveDesc, cancelDesc,
    openDescriptionPopout,
  } = useVacancyDescription(v, onUpdate)

  // Edit-toggle control block (pencil ↔ save/cancel), same pattern as DetailsTab's
  // Algemeen card — an independent editing state, own title row placement.
  const controls = descEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <Button variant="dangerSoft" iconOnly size="sm" onClick={() => setDescription('')} title={t('common:remove')} aria-label={t('common:remove')}><Trash2 size={13} /></Button>
      <Button variant="primary" iconOnly size="sm" onClick={saveDesc} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
      <Button variant="secondary" iconOnly size="sm" onClick={cancelDesc} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
    </div>
  ) : (
    <Button variant="secondary" iconOnly size="sm" onClick={() => setDescEditing(true)} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{t('details.description')}</GroupLabel>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* V-desc-1: second screen — same icon + footprint the candidate
              profile-text pop-out uses, in this block's own title row. */}
          <Button variant="secondary" iconOnly size="sm" onClick={openDescriptionPopout} title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}>
            <ExternalLink size={13} />
          </Button>
          {controls}
        </div>
      </div>
      {descEditing
        ? <RichTextEditor value={description} onChange={setDescription} expanded={descExpanded} onToggleExpand={() => setDescExpanded(x => !x)}
            // VACGEN-1/KOIOS-GENERATE-1: "Genereer met Koios" now rides the SAME
            // shared RichTextAssistBar affordance every other rich-text field uses
            // (mirrors ProfileTab/OverviewTab) instead of the bespoke
            // VacancyGenerateFlow chip — one generate UX everywhere, editor-gated
            // like the others (Genereren only while editing).
            assistGenerate={v.id ? { entity: 'vacancy', id: String(v.id) } : undefined} />
        : (v.description
            // Full height — the block grows with the text; the drawer body scrolls
            // when it overflows (Danny 23-07: no inner 220px scrollbox on a full tab).
            ? <div style={{ ...blockStyle, padding: '10px 12px' }}><SafeHtml html={v.description} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} /></div>
            : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>)}
    </div>
  )
}
