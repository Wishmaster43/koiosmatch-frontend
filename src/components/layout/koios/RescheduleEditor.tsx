/**
 * RescheduleEditor — the inline "adjust before it runs" editor for a Koios
 * suggestion action whose input carries a `due_date` (RESCHEDULE-EDIT-1,
 * Danny 29-09: "reschedule: verwacht ik dat je een nieuwe datum kan ingeven",
 * on a reschedule popup that only showed Confirm/Cancel on the raw proposed
 * date). Prefills the shared `DateField` with the server's proposal, shows
 * the Koios proposal badge while the value still matches that proposal, and
 * clears the badge the moment the user changes it — CLAUDE.md §0B: "a way to
 * adjust it before running".
 */
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import { DateField } from '@/components/forms/fields'
import KoiosSuggestionBadge from '@/components/ui/KoiosSuggestionBadge'
import type { KoiosAssistantAction } from './useKoiosAssistant'

interface Props {
  action: KoiosAssistantAction
  onConfirm: (input: Record<string, unknown>) => void
  onCancel: () => void
}

// The action's own args (either envelope key) so the edited date merges back
// into the same input shape the server already expects.
const argsOf = (a: KoiosAssistantAction) => a.input ?? a.args ?? {}

export default function RescheduleEditor({ action, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('common')
  const titleId = useId()
  const dateInputId = useId()
  const originalInput = argsOf(action)
  const proposedDate = typeof originalInput.due_date === 'string' ? originalInput.due_date : ''
  const [date, setDate] = useState(proposedDate)
  // The badge shows only while the field still holds Koios's own proposal —
  // any edit (or clearing it) drops the mark, never a stale "this is a proposal".
  const isProposal = date !== '' && date === proposedDate
  const confirmDisabled = date === ''
  // Opening the editor unmounts the focused action button (SuggestionActions
  // returns null in the 'editing' phase), so a keyboard user would otherwise
  // lose focus to <body>. Focus the container itself, never the date input —
  // focusing DateField's input opens the react-datepicker popup unasked.
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => { containerRef.current?.focus() }, [])
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      style={{ marginLeft: 26, display: 'flex', flexDirection: 'column', gap: 4 }}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
    >
      <GroupLabel id={titleId}>{t('koios.assistant.rescheduleTitle')}</GroupLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Visually hidden label: DateField's custom input only forwards required/aria-required. */}
        <label htmlFor={dateInputId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {t('koios.assistant.rescheduleTitle')}
        </label>
        <DateField id={dateInputId} value={date} onChange={setDate} />
        {isProposal && <KoiosSuggestionBadge labelKey="koios.assistant.proposedDate" />}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" variant="primary" disabled={confirmDisabled}
          onClick={() => onConfirm({ ...originalInput, due_date: date })}>
          {t('koios.assistant.rescheduleConfirm')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t('koios.pendingAction.cancel')}
        </Button>
      </div>
    </div>
  )
}
