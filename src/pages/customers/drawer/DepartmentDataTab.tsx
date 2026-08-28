/**
 * DepartmentDataTab — the "Gegevens" sub-tab body of DepartmentDetail: the
 * field-table card, the description rich-text block and the Koios advice
 * block. §0.3 split (2026-08-28, mechanical extraction, no behavior change) —
 * lifted verbatim out of DepartmentDetail.tsx, which was over the ~400-line
 * split trigger (§3). See DepartmentDetail's own docblock for the history of
 * every comment kept below (PARITY-DEPARTMENT-1, CANON-DIVIDER-1, K5a, …).
 */
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import EditableRichTextField from './EditableRichTextField'
import KoiosAdviceBlock from '@/components/ai/KoiosAdviceBlock'
import { buildDepartmentAdviceInsights, type Tx } from './departmentAiInsights'
import { departmentPopoutId } from '@/lib/secondScreen'
import type { Department } from '@/types/customer'
import type { Id } from '@/types/common'

// The "Gegevens" sub-tab: field-table card + description rich-text + Koios advice.
export default function DepartmentDataTab({ department, fields, values, onSaveFields, onSaveDescription, customerId, t }: {
  department: Department
  fields: FieldRow[]
  values: Record<string, unknown>
  onSaveFields: (v: Record<string, unknown>) => void
  onSaveDescription: (html: string) => void
  customerId?: Id
  t: Tx
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* No repeated title (verified, unlike LocationDetail — see the file header
          comment): this sub-tab's own label already IS "Gegevens"/"Details" in
          three of five locales, identical to the group title, so a card title
          here would duplicate it AND collide with DepartmentsPanel.test.tsx's
          getByText on that sub-tab label. */}
      {/* CANON-DIVIDER-1 (Danny 05-08): candidate ProfileTab canon — no line
          between rows, 11px labels. */}
      {/* Canon width (fieldRowCanon, 05-08): EditableFieldTable's own default now matches. */}
      <EditableFieldTable title="" fields={fields} value={values} onSave={onSaveFields} />

      {/* Omschrijving AFTER the data blocks — Danny 02-08: every entity's prose block
          follows the customer Bedrijf-tab order (fields → text → Koios), so the
          earlier description-first placement was reversed on both location and here. */}
      {/* K5a (batch 5): second-screen icon, composite customerId:departmentId
          (departmentPopoutId — no standalone GET for one department). No
          `assistGenerate` yet — see CustomerDepartmentTextPopout's docblock
          for the written reason (GenerateEntity type widening is out of scope
          here). */}
      <EditableRichTextField label={t('departments.detail.description')} value={department.description ?? ''} onSave={onSaveDescription}
        popout={customerId != null ? { entity: 'customer', id: departmentPopoutId(customerId, department.id as Id), field: 'departmentText' } : undefined} />

      {/* Koios advice — pure FE completeness heuristics over this department's OWN
          fields, same slot LocationDetail/OverviewTab put it in (right after the
          text block, before any nested-entity sections). No API call. */}
      <KoiosAdviceBlock namespace="customers" insights={buildDepartmentAdviceInsights(department, t)} />
    </div>
  )
}
