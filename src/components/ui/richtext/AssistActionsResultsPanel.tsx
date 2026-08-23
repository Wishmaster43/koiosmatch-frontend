/**
 * AssistActionsResultsPanel — the shared "Actiepunten" result surface,
 * promoted from the note domain (CMFE-KOIOS-CONSISTENCY-1, Danny 09-08 — §11
 * one source, every rich-text field gets the same wizard, not a note-only
 * copy). Before "Uitvoeren": the plain suggested-items preview + three actions
 * (Uitvoeren / Als tekst toevoegen — the OLD append-as-list apply, kept as a
 * secondary option / Verwerpen). After "Uitvoeren": one AssistActionItemCard
 * per item with its live execute status, a Klaar close, and — for an executed
 * item's `run_id` — the shared RunDetailDrawer (fetched fresh; the execute
 * response only carries the id, not the full run row the drawer needs).
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, X } from 'lucide-react'
import RunDetailDrawer from '@/components/reports/RunDetailDrawer'
import { Z } from '@/lib/zIndexScale'
import { fetchWorkflowRun } from './assistActionsExecuteApi'
import type { ExecuteSource } from './assistActionsExecuteApi'
import { useAssistActionsExecute } from './useAssistActionsExecute'
import AssistActionItemCard from './AssistActionItemCard'
import { ACTION_TYPE_LABEL_NL } from './richTextAssistApi'
import type { RichTextAssistActionItem } from './richTextAssistApi'
import type { RunRow } from '@/types/reports'
import { humanizeIsoDates } from '@/lib/localDate'
import Spinner from '../Spinner'
import Button from '../Button'
import { Caption } from '../typography'


interface AssistActionsResultsPanelProps {
  // The suggested items from the assist 'actions' result.
  items: RichTextAssistActionItem[]
  // Where the batch links back to — TODAY only an existing note (`note_id`);
  // omitted for every other field (mirrors a new, unsaved note: no linkage).
  source?: ExecuteSource
  // The OLD apply semantics (append the items as a bullet list into the field
  // value) — kept as the secondary option, mirrors the previous "Overnemen".
  onApplyAsText: () => void
  // Discard the whole suggestion — mirrors the previous "Verwerpen".
  onDiscard: () => void
}

export default function AssistActionsResultsPanel({ items, source, onApplyAsText, onDiscard }: AssistActionsResultsPanelProps) {
  const { t } = useTranslation('common')
  const exec = useAssistActionsExecute(source)
  // Guards the ONE-time text append (idempotent across re-clicks/re-renders).
  const appliedRef = useRef(false)
  // The run being inspected (fetched fresh from its id) — null = drawer closed.
  const [viewingRun, setViewingRun] = useState<RunRow | null>(null)
  const [runLoading, setRunLoading] = useState(false)

  // Fetch the single run row (the execute response only carries the id) and
  // open the SAME shared RunDetailDrawer the runs list uses — never a second
  // hand-built run view (§3A reuse, never duplicate).
  const viewRun = async (runId: string) => {
    setRunLoading(true)
    try {
      setViewingRun(await fetchWorkflowRun(runId))
    } catch {
      // Honest no-op: the card's own "Uitgevoerd" state already proved the
      // action ran — a failed detail fetch just means the drawer can't open now.
    } finally {
      setRunLoading(false)
    }
  }

  // Before "Uitvoeren": the plain preview list, unchanged from before this
  // feature, plus the three top-level actions.
  if (exec.items === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
          {items.map((it, i) => (
            <li key={i}>
              <strong>{it.title}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>
                ({t(`notesAssist.actionTypes.${it.type}`, { defaultValue: ACTION_TYPE_LABEL_NL[it.type] })}{it.due_date ? ` · ${humanizeIsoDates(it.due_date)}` : ''})
              </span>
            </li>
          ))}
        </ul>
        {exec.status === 'error' && (
          <div style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{exec.errorMessage}</div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* ONE button (Danny 23-08 punt 3: "toevoegen aan tekst en uitvoeren
              moet samen een knop zijn"): starting the wizard ALSO appends the
              list into the field — EXACTLY once, ref-guarded, so a double click
              can never stack the list into the text again (Danny: "6 keer op de
              knop en alles komt 6 keer in de tekst — moet niet kunnen"). */}
          <Button variant="primary" size="sm" disabled={exec.status === 'loading'}
            onClick={() => {
              if (!appliedRef.current) { appliedRef.current = true; onApplyAsText() }
              exec.preview(items)
            }}>
            {exec.status === 'loading' ? <Spinner size={13} /> : <Play size={13} />}
            {t('notesAssist.execute.run', { defaultValue: 'Uitvoeren' })}
          </Button>
          <Button variant="secondary" size="sm" onClick={onDiscard}>
            <X size={13} /> {t('notesAssist.discard', { defaultValue: 'Verwerpen' })}
          </Button>
        </div>
      </div>
    )
  }

  // After "Uitvoeren": one live card per item + a close.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {exec.items.map((it, i) => (
        <AssistActionItemCard key={i} item={it}
          onConfirm={() => exec.confirm(i)}
          onViewRun={it.status === 'executed' && it.run_id ? () => viewRun(it.run_id as string) : undefined} />
      ))}
      {runLoading && <Caption as="div">{t('notesAssist.execute.loadingRun', { defaultValue: 'Run laden…' })}</Caption>}
      <div>
        <Button variant="secondary" size="sm" onClick={exec.reset}>
          <X size={13} /> {t('notesAssist.execute.done', { defaultValue: 'Klaar' })}
        </Button>
      </div>
      {/* HUISSTIJL-1: RunDetailDrawer (src/components/reports, out of scope) types
          `zIndex?: number` — Z.confirm can't become a CSS var string without touching
          that file; kept as-is. */}
      {viewingRun && <RunDetailDrawer run={viewingRun} onClose={() => setViewingRun(null)} zIndex={Z.confirm} />}
    </div>
  )
}
