/**
 * InstructionListField — ai_agent's `instructions` field (type
 * 'instruction_list', INTERVIEW-WORKFLOW-1). A reorderable list of AI-interview
 * questions, each a rich-text block with an optional output-field mapping, a
 * required toggle and a per-row "···" menu (insert variable / duplicate /
 * delete) — the house answer to the competitor screenshot in the brief, built
 * from the SAME atoms as every other list field (OrderedListField's
 * move/add/remove idiom via arrow buttons — not drag-and-drop, RichTextEditor,
 * DrawerAddButton, ActionMenu).
 *
 * CMBE contract limits (INTERVIEW-WORKFLOW-1 Appendix C, 2026-08-30): at most
 * 50 instructions, at most 2000 characters each, at most 30 000 characters in
 * total. The control never truncates silently — it only disables "add" at the
 * row cap and colours a counter past a per-row limit; the stored value is
 * never cut. Counts are the stored string length (the RichTextEditor's HTML),
 * not the stripped plain text, same honesty rule as everywhere else here.
 */
import { ChevronUp, ChevronDown, Braces, Copy, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Caption, GroupLabel, monoStyle } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import ActionMenu from '@/components/ui/ActionMenu'
import type { MenuOption } from '@/components/ui/ActionMenu'
import Toggle from '@/components/ui/Toggle'
import RichTextEditor from '@/components/ui/RichTextEditor'
import CreatableSelect from '@/components/ui/CreatableSelect'
import type { WorkflowVarGroup } from '@/types/workflow'
import type { InstructionOutputField } from '../filterFieldCatalog'
import { useInstructionList } from './useInstructionList'
import type { OnChange } from './types'

// CMBE-accepted caps (INTERVIEW-WORKFLOW-1 Appendix C) — see file docblock.
const MAX_ROWS = 50
const MAX_CHARS_PER_ROW = 2000
const MAX_TOTAL_CHARS = 30_000

// Flatten every upstream module's fields into one searchable token list — the
// SAME WorkflowVarField vocabulary the textarea variable picker offers
// elsewhere (never a second token source).
function flattenVarOptions(variables: WorkflowVarGroup[]): MenuOption[] {
  return variables.flatMap(g =>
    g.fields.map(f => ({ value: f.token, label: `${g.customName ?? g.moduleType} · ${f.label}` })))
}

export function InstructionListField({ value, onChange, fieldKey, variables = [], outputFields }: {
  value?: unknown; onChange: OnChange; fieldKey: string; variables?: WorkflowVarGroup[]
  // Server-served output_field allow-list (INTERVIEW-WORKFLOW-1 CMBE delta) — when
  // absent/empty the control renders NO output-field mapping at all (no fake
  // affordance, §3), but a value already stored on a row still round-trips untouched.
  outputFields?: InstructionOutputField[]
}) {
  const { t } = useTranslation('workflows')
  const { rows, add, remove, duplicate, move, update, insertVar } = useInstructionList(value, onChange, fieldKey)
  const varOptions = flattenVarOptions(variables)
  const hasOutputFields = !!outputFields?.length
  const outputOptions = (outputFields ?? []).map(f => ({ value: f.key, label: f.label }))
  const totalChars = rows.reduce((sum, r) => sum + (r.text?.length ?? 0), 0)
  const atRowCap = rows.length >= MAX_ROWS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row, i) => {
        const rowChars = row.text?.length ?? 0
        const overRowLimit = rowChars > MAX_CHARS_PER_ROW
        return (
          <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Row header — number, reorder arrows, per-row menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GroupLabel as="span">
                {t('fields.instructionRow', { n: i + 1 })}
              </GroupLabel>
              <span style={{ flex: 1 }} />
              <Caption as="span" style={{ color: overRowLimit ? 'var(--color-danger-text)' : undefined }}>
                {t('fields.instructionCharCount', { count: rowChars, max: MAX_CHARS_PER_ROW })}
              </Caption>
              <Button iconOnly variant="ghost" size="sm" onClick={() => move(row.id, -1)} disabled={i === 0}
                aria-label={t('fields.moveUp')} title={t('fields.moveUp')}>
                <ChevronUp size={13} />
              </Button>
              <Button iconOnly variant="ghost" size="sm" onClick={() => move(row.id, 1)} disabled={i === rows.length - 1}
                aria-label={t('fields.moveDown')} title={t('fields.moveDown')}>
                <ChevronDown size={13} />
              </Button>
              <ActionMenu iconOnly ariaLabel={t('fields.instructionRowMenu')} menuWidth={240} align="right"
                items={[
                  { key: 'insertVar', label: t('fields.instructionInsertVar'), icon: Braces,
                    options: varOptions, searchable: true, searchPlaceholder: t('vars.search'), emptyText: t('vars.noUpstream'),
                    onPick: v => insertVar(row.id, String(v)) },
                  { key: 'duplicate', label: t('fields.instructionDuplicate'), icon: Copy, onSelect: () => duplicate(row.id) },
                  { key: 'delete', label: t('common:remove'), icon: Trash2, danger: true, onSelect: () => remove(row.id) },
                ]} />
            </div>

            {/* Rich-text instruction body — the actual agent question/step. */}
            <RichTextEditor value={row.text} onChange={html => update(row.id, { text: html })} minHeight={70} showLanguage={false} assist={false} />

            {/* Optional output-field mapping + required toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasOutputFields && (
                <div style={{ flex: 1 }}>
                  {/* row.id is already a stable per-row id, so it doubles as the sr-only
                      label id here (CreatableSelect's trigger is a <button>, which a plain
                      aria-label cannot name — see LookupSelectField for the same pattern). */}
                  <span id={`instr-output-label-${row.id}`} className="sr-only">{t('fields.instructionOutputField')}</span>
                  <CreatableSelect value={row.output_field ?? ''} onChange={v => update(row.id, { output_field: v })}
                    aria-labelledby={`instr-output-label-${row.id}`}
                    allowCreate={false} clearable clearLabel={t('fields.instructionOutputField')}
                    placeholder={t('fields.instructionOutputPlaceholder')}
                    options={outputOptions} style={{ width: '100%', padding: '5px 7px', fontSize: 12, ...monoStyle }} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Toggle checked={!!row.required} onChange={v => update(row.id, { required: v })} ariaLabel={t('fields.instructionRequired')} />
                <Caption as="span">{t('fields.instructionRequired')}</Caption>
              </div>
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* HUISSTIJL-1: the ONE "+ add" affordance, app-wide (§3A). */}
          <DrawerAddButton onClick={add} label={t('fields.instructionAdd')} disabled={atRowCap} />
          <Caption as="span">{t('fields.instructionCount', { count: rows.length })}</Caption>
        </div>
        {atRowCap && <Caption as="span">{t('fields.instructionMaxReached', { max: MAX_ROWS })}</Caption>}
        <Caption as="span" style={{ color: totalChars > MAX_TOTAL_CHARS ? 'var(--color-danger-text)' : undefined }}>
          {t('fields.instructionTotalChars', { count: totalChars, max: MAX_TOTAL_CHARS })}
        </Caption>
      </div>
    </div>
  )
}
