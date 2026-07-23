import type { ComponentType, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2 } from 'lucide-react'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import VacancyGenerateFlow from './VacancyGenerateFlow'
import { useVacancyDescription } from '../hooks/useVacancyDescription'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
const groupTitle: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }

/**
 * DescriptionTab — the vacancy description as its OWN drawer main-tab (Danny
 * 21-07: split out of DetailsTab's Profiel sub-tab so it reads as a standalone
 * section, mirroring the candidate profile text). Same rich editor, "Genereer
 * met Koios" flow, and its own independent pencil/save/cancel toggle as before —
 * only the state now lives in useVacancyDescription instead of the field-grid hook.
 */
export default function DescriptionTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const {
    descEditing, setDescEditing, descExpanded, setDescExpanded, description, setDescription, saveDesc, cancelDesc,
    descKey, applyGeneratedConcept,
  } = useVacancyDescription(v, onUpdate)

  // Edit-toggle control block (pencil ↔ save/cancel), same pattern as DetailsTab's
  // Algemeen card — an independent editing state, own title row placement.
  const controls = descEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={() => setDescription('')} title={t('common:remove')} style={{ ...iconBtn, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--border)' }}><Trash2 size={13} /></button>
      <button onClick={saveDesc} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
      <button onClick={cancelDesc} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
    </div>
  ) : (
    <button onClick={() => setDescEditing(true)} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={groupTitle}>{t('details.description')}</span>
        {controls}
      </div>
      {/* VACGEN-1 fase 1b: "Genereer met Koios" — resolves the tenant's generation
          profile, generates a CONCEPT, and only feeds it into this draft on an
          explicit "Toepassen" (never a silent overwrite of the saved text). */}
      <VacancyGenerateFlow vacancy={v} onApply={applyGeneratedConcept} />
      {descEditing
        ? <RichTextEditor key={descKey} value={description} onChange={setDescription} expanded={descExpanded} onToggleExpand={() => setDescExpanded(x => !x)} />
        : (v.description
            // Full height — the block grows with the text; the drawer body scrolls
            // when it overflows (Danny 23-07: no inner 220px scrollbox on a full tab).
            ? <div style={{ ...blockStyle, padding: '10px 12px' }}><SafeHtml html={v.description} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} /></div>
            : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>)}
    </div>
  )
}
