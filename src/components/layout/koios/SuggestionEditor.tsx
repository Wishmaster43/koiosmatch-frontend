/**
 * SuggestionEditor — the inline "adjust before it runs" editor for a Koios
 * suggestion action (TASK-CREATE-EDIT-1, generalising RESCHEDULE-EDIT-1: "a
 * way to adjust it before running", CLAUDE.md §0B). Which fields render comes
 * from the pure `suggestionEditorSpec` (title / due date / priority); a
 * reschedule action still shows the date-only shape byte-identical to the
 * original RescheduleEditor, a create_task action adds title + priority
 * (Danny 29-09: "due date en prio is toch ook belangrijk?"). Prefilled values
 * that match the server's own proposal carry the Koios badge; any edit (or a
 * fallback to the tenant default priority) drops it — never a stale "this is
 * a proposal" on a value the user or a plain setting chose.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import { TextField, DateField } from '@/components/forms/fields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import KoiosSuggestionBadge from '@/components/ui/KoiosSuggestionBadge'
import { TaskLookupsProvider, useTaskLookups } from '@/context/TaskLookupsContext'
import { editorFieldsForAction, resolvedEditorKey, TITLE_KEY, CONFIRM_KEY } from './suggestionEditorSpec'
import type { KoiosAssistantAction } from './useKoiosAssistant'

interface Props {
  action: KoiosAssistantAction
  onConfirm: (input: Record<string, unknown>) => void
  onCancel: () => void
}

// The action's own args (either envelope key) so the edited values merge back
// into the same input shape the server already expects.
const argsOf = (a: KoiosAssistantAction) => a.input ?? a.args ?? {}

// The priority picker on its own component so `useTaskLookups` (a real context
// hook, unavailable in the reschedule-only tests) is only ever called while a
// create_task-shaped editor actually mounts this field — never for reschedule.
function PriorityField({ id, value, isProposal, onChange, t }: {
  id: string; value: string; isProposal: boolean; onChange: (v: string) => void; t: (key: string) => string
}) {
  const { priorities, defaultPriority } = useTaskLookups()
  // No priority proposed by the server yet → seed the tenant default (a
  // setting, never a Koios guess, so it carries no badge). The `!value` guard
  // makes this self-limiting (it never re-fires once a value is set), so the
  // full dependency list stays honest — no disable needed (REFS-IN-EFFECTS-1).
  useEffect(() => { if (!value) onChange(defaultPriority) }, [value, defaultPriority, onChange])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* DROPDOWN-CLEAR-1: an emptied priority is re-seeded to the tenant default by
          the effect above (and the BE falls back to is_default), so a clear cross
          would be a no-op affordance. */}
      <CreatableSelect id={id} value={value} onChange={onChange} allowCreate={false} clearable={false}
        options={priorities.map(p => ({ value: p.value, label: p.label }))} placeholder={t('koios.pendingAction.fields.priority')} />
      {isProposal && <KoiosSuggestionBadge labelKey="koios.assistant.proposedDate" />}
    </div>
  )
}

// The priority field needs its own TaskLookupsContext scope: the Koios panel
// mounts app-wide (DashboardLayout) with no TaskLookupsProvider above it, so
// this field carries its own provider rather than assuming a page-scoped one.
function PriorityFieldScope(props: Parameters<typeof PriorityField>[0]) {
  return (
    <TaskLookupsProvider>
      <PriorityField {...props} />
    </TaskLookupsProvider>
  )
}

export default function SuggestionEditor({ action, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('common')
  const titleId = useId()
  const dateInputId = useId()
  const priorityId = useId()
  const titleInputId = useId()
  const originalInput = argsOf(action)
  const hasDueDate = typeof originalInput.due_date === 'string'
  const fields = editorFieldsForAction(action.key, hasDueDate) ?? []
  const key = resolvedEditorKey(action.key, hasDueDate) ?? 'reschedule_task'
  const showTitle = fields.some(f => f.key === 'title')
  const showDueDate = fields.some(f => f.key === 'due_date')
  const showPriority = fields.some(f => f.key === 'priority')

  const proposedDate = hasDueDate ? (originalInput.due_date as string) : ''
  const [date, setDate] = useState(proposedDate)
  const isDateProposal = date !== '' && date === proposedDate

  const [title, setTitle] = useState(typeof originalInput.title === 'string' ? originalInput.title : '')

  // The BE proposes a priority slug (ADDENDUM 09:35) or nothing yet — the
  // PriorityField itself seeds the tenant default once mounted.
  const proposedPriority = typeof originalInput.priority === 'string' ? originalInput.priority : ''
  const [priority, setPriority] = useState(proposedPriority)
  const isPriorityProposal = proposedPriority !== '' && priority === proposedPriority

  // create_task: only the title is required (due_date may stay empty — the
  // card then shows "no deadline"). reschedule_task: byte-identical to the
  // original RescheduleEditor, where the date IS the whole point of the editor.
  const confirmDisabled = (showTitle && title.trim() === '') || (key === 'reschedule_task' && date === '')
  // Opening the editor unmounts the focused action button (SuggestionActions
  // returns null in the 'editing' phase), so a keyboard user would otherwise
  // lose focus to <body>. Focus the container itself, never the date input —
  // focusing DateField's input opens the react-datepicker popup unasked.
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => { containerRef.current?.focus() }, [])

  // Builds the confirmed input: title/priority only ride along when the
  // editor actually offers them; due_date is dropped entirely when left
  // empty (the card then shows the "no deadline" hint, never a silent date).
  const handleConfirm = () => {
    const next: Record<string, unknown> = { ...originalInput }
    if (showTitle) next.title = title
    if (showDueDate) { if (date) next.due_date = date; else delete next.due_date }
    if (showPriority) next.priority = priority
    onConfirm(next)
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      style={{ marginLeft: 26, display: 'flex', flexDirection: 'column', gap: 4 }}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
    >
      <GroupLabel id={titleId}>{t(TITLE_KEY[key])}</GroupLabel>
      {showTitle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label htmlFor={titleInputId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {t('koios.pendingAction.fields.title')}
          </label>
          <TextField id={titleInputId} value={title} onChange={setTitle} placeholder={t('koios.pendingAction.fields.title')} style={{ width: '100%' }} />
        </div>
      )}
      {(showDueDate || showPriority) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {showDueDate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Visually hidden label: DateField's custom input only forwards required/aria-required.
                  Reschedule keeps its original accessible name (rescheduleTitle) and no
                  placeholder, byte-identical to the pre-existing RescheduleEditor. */}
              <label htmlFor={dateInputId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                {t(key === 'reschedule_task' ? 'koios.assistant.rescheduleTitle' : 'koios.pendingAction.fields.due_date')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DateField id={dateInputId} value={date} onChange={setDate} placeholder={key === 'reschedule_task' ? undefined : t('koios.assistant.noDueDate')} />
                {isDateProposal && <KoiosSuggestionBadge labelKey="koios.assistant.proposedDate" />}
              </div>
            </div>
          )}
          {showPriority && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label htmlFor={priorityId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                {t('koios.pendingAction.fields.priority')}
              </label>
              <PriorityFieldScope id={priorityId} value={priority} isProposal={isPriorityProposal} onChange={setPriority} t={t} />
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" variant="primary" disabled={confirmDisabled} onClick={handleConfirm}>
          {t(CONFIRM_KEY[key])}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('koios.pendingAction.cancel')}
        </Button>
      </div>
    </div>
  )
}
