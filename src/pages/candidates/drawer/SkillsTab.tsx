/**
 * SkillsTab — skills list tab: level is a tenant lookup, and a row can
 * optionally link an already-uploaded proof document once the candidate has
 * any. Split out of the former SectionTabs.tsx verbatim (§3 size discipline) —
 * no behaviour change, only file boundaries.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRelationSort } from '@/components/forms/useRelationSort'
import DocPreviewModal from '@/components/drawer/DocPreviewModal'
import LookupIcon from '@/components/ui/LookupIcon'
import { useSkillLevels } from '@/lib/useSkillLevels'
// DOC-1-EIGENAAR-1: the one shared "which document is still free" rule (measured 08-08).
import { linkedDocumentOptions } from './documentLinkRules'
import type { Id } from '@/types/common'
import { AddableSection, DocEntryLinks, renderAddButton, resolveLinkedDocument } from './sectionTabsShared'
import type { RelItem, RelTabProps } from './sectionTabsShared'

// Skills list tab: level is a tenant lookup, and a row can optionally link an already-uploaded proof document once the candidate has any.
export function SkillsTab({ items = [], onAdd, onEdit, onRemove, documents = [], onJumpToDocuments, onReorder }: RelTabProps) {
  const { t } = useTranslation('candidates')
  // Level is a tenant lookup dropdown (SKILL-LVL-1), mirroring the languages editor.
  // LOOKUP-ICON-1: useSkillLevels now returns full {value,label,icon,color}
  // objects (was string[]) — the AddForm `options` field still only needs
  // label text, so pass `names`; the icon lookup below reads the full `levels`.
  const { levels, names: levelNames } = useSkillLevels()
  const levelIconOf = (label: string) => levels.find(l => l.label === label)?.icon
  // DOC-LANG-SKILL-LINK-1: preview overlay for a row's linked proof document — the
  // shared house DocPreviewModal (never a fork), mirrors Education/Certifications.
  const [previewDoc, setPreviewDoc] = useState<RelItem | null>(null)
  // "Koppelen aan" picker options, resolved PER ROW — only documents no other entry
  // has claimed, plus this row's own pick (DOC-1-EIGENAAR-1).
  const documentOptions = linkedDocumentOptions(documents, items)
  const fields = [
    // KAND-ACHTERGROND-VERPLICHT-1: `name` is required on create
    // (CandidateSkillController::rules, measured 2026-08-17) — `level` is a tenant
    // lookup validated `sometimes`/`nullable` (MatchRules::fromLookup), never required.
    { key: 'name',  label: t('addFields.skill'), required: true },
    { key: 'level', label: t('addFields.skillLevel'), options: levelNames },
    // DOC-LANG-SKILL-LINK-1: optionally link an already-uploaded proof document to this
    // entry (only offered once the candidate HAS documents — §3, no fake affordance).
    ...(documents.length > 0 ? [{ key: 'document_id', label: t('addFields.linkedDocument'), options: documentOptions }] : []),
  ]
  // Sub-tab sort notes: candidate_skills has no date column and no function/
  // title field — nothing in the start date / end date / function set applies
  // (Requirement 2: never offer an option with nothing to sort by). DRAG-SORT-1:
  // it DOES carry sort_order + PUT .../reorder, so 'own' is the ONE axis this
  // tab offers — its menu is new because of this, not a regression.
  const { order, control, isOwnOrder } = useRelationSort(items, { storageKey: 'skills', ownOrder: true })
  // Skills render as a vertical list (one per row) so edit/remove read clearly.
  return (
    <>
    <AddableSection title={null} emptyText={t('sections.skillsEmpty')} renderAddButton={renderAddButton} order={order} headerExtra={control}
      dragEnabled={isOwnOrder} onReorder={onReorder}
      items={items} fields={fields} onAdd={onAdd} onEdit={onEdit} onRemove={onRemove}
      renderItem={(raw: RelItem, i: number, arr: RelItem[]) => {
        const v = raw as { id?: Id; name?: string; skill?: string; level?: string }
        const name  = typeof raw === 'string' ? raw : (v.name ?? v.skill ?? '')
        const level = typeof raw === 'string' ? '' : (v.level ?? '')
        // LOOKUP-ICON-1: the skill-level tenant icon, shown next to the level text.
        const levelIcon = level ? levelIconOf(level) : undefined
        // DOC-LANG-SKILL-LINK-1: resolve the linked proof document, if any — icons
        // render only when found. A legacy plain-string skill has no id to link by.
        const linkedDoc = typeof raw === 'string' ? undefined : resolveLinkedDocument(raw, documents, 'skill_id')
        return (
          <div key={v.id ?? i} style={{ display: 'flex', gap: 8, padding: '8px 0', paddingRight: 56,
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</span>
                {level && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--text-muted)' }}>
                    · {levelIcon && <LookupIcon icon={levelIcon} size={11} />}{level}
                  </span>
                )}
              </div>
              {linkedDoc && <DocEntryLinks doc={linkedDoc} onPreview={() => setPreviewDoc(linkedDoc)} onJump={onJumpToDocuments} />}
            </div>
          </div>
        )
      }} />
    {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </>
  )
}
