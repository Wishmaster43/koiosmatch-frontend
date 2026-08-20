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
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, FileText, X } from 'lucide-react'
import RunDetailDrawer from '@/components/reports/RunDetailDrawer'
import { Z } from '@/lib/zIndexScale'
import { fetchWorkflowRun } from './assistActionsExecuteApi'
import type { ExecuteSource } from './assistActionsExecuteApi'
import { useAssistActionsExecute } from './useAssistActionsExecute'
import AssistActionItemCard from './AssistActionItemCard'
import { ACTION_TYPE_LABEL_NL } from './richTextAssistApi'
import type { RichTextAssistActionItem } from './richTextAssistApi'
import type { RunRow } from '@/types/reports'
import Spinner from '../Spinner'

const primaryBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }
const ghostBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }

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
                ({t(`notesAssist.actionTypes.${it.type}`, { defaultValue: ACTION_TYPE_LABEL_NL[it.type] })}{it.due_date ? ` · ${it.due_date}` : ''})
              </span>
            </li>
          ))}
        </ul>
        {exec.status === 'error' && (
          <div style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{exec.errorMessage}</div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => exec.preview(items)} disabled={exec.status === 'loading'} style={{ ...primaryBtn, opacity: exec.status === 'loading' ? 0.7 : 1 }}>
            {exec.status === 'loading' ? <Spinner size={13} /> : <Play size={13} />}
            {t('notesAssist.execute.run', { defaultValue: 'Uitvoeren' })}
          </button>
          <button type="button" onClick={onApplyAsText} style={ghostBtn}>
            <FileText size={13} /> {t('notesAssist.execute.applyAsText', { defaultValue: 'Als tekst toevoegen' })}
          </button>
          <button type="button" onClick={onDiscard} style={ghostBtn}>
            <X size={13} /> {t('notesAssist.discard', { defaultValue: 'Verwerpen' })}
          </button>
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
      {runLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('notesAssist.execute.loadingRun', { defaultValue: 'Run laden…' })}</div>}
      <div>
        <button type="button" onClick={exec.reset} style={ghostBtn}>
          <X size={13} /> {t('notesAssist.execute.done', { defaultValue: 'Klaar' })}
        </button>
      </div>
      {/* HUISSTIJL-1: RunDetailDrawer (src/components/reports, out of scope) types
          `zIndex?: number` — Z.confirm can't become a CSS var string without touching
          that file; kept as-is. */}
      {viewingRun && <RunDetailDrawer run={viewingRun} onClose={() => setViewingRun(null)} zIndex={Z.confirm} />}
    </div>
  )
}
