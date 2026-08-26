/**
 * MatchRemarksBlock — REMARKS-INTO-NOTES-1 (Danny 09-08). The match drawer
 * carried TWO free-text fields side by side doing the same job. Decision:
 * **Matchtekst stays** (`match_text`, MatchTextBlock — the substantive
 * reasoning behind the match) and **Opmerkingen is retired as an editable
 * field**: that content belongs in NOTES, where it gets an author, a date, a
 * type and a channel, and lands in the timeline.
 *
 * Nothing is thrown away. Measured 09-08 against the live API:
 *   - GET /matches/{id} carries BOTH `match_text` and `remarks` (nullable
 *     strings) and PATCH /matches/{id} persists both;
 *   - the match already supports notes — GET/POST/DELETE /matches/{id}/notes,
 *     with types from GET /note-types?entity=match.
 * So this is option (a): a READ-ONLY legacy block. It renders ONLY when
 * `remarks` still holds content — an empty field renders nothing, so the drawer
 * no longer offers a second editor — states in plain (translated) language that
 * the field is going away, and offers ONE real move: POST the text as a note
 * FIRST and clear `remarks` only after the server confirmed that note. A failed
 * clear leaves both copies visible (no loss), never a cleared field without a note.
 *
 * No editor here anymore, so no RichTextEditor and no assist bar: Matchtekst is
 * now the single free-text surface on this drawer.
 */
import { useState, useId } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowRight } from 'lucide-react'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import SelectMenu from '@/components/ui/SelectMenu'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useNoteTypes } from '@/lib/useNoteTypes'
import type { MatchContract } from '../hooks/useMatchContract'
import type { Id } from '@/types/common'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helper — accept any props at the boundary.
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

interface Props {
  remarks: string | null
  loading: boolean
  // The shared useMatchContract save — used for exactly one thing here: clearing
  // the legacy field AFTER its content was safely copied into a note.
  save: (patch: Partial<MatchContract>) => Promise<void>
  // The match's own id — the notes route is per match; without it the move is
  // honestly disabled instead of silently doing nothing (§3).
  matchId?: Id
  // Jumps the drawer to the Notes tab after a successful move, so the recruiter
  // immediately sees where the text landed.
  onOpenNotes?: () => void
}

// The read-only legacy remarks block; renders nothing
// once `remarks` is empty, offering only a one-way move into Notes.
export default function MatchRemarksBlock({ remarks, loading, save, matchId, onOpenNotes }: Props) {
  const { t } = useTranslation('matches')
  const typeLabelId = useId()
  // Note categories from the tenant lookup, scoped to 'match' — the same list the
  // Notes tab writes with, so a moved remark gets a real, valid type.
  const { writableTypes } = useNoteTypes('match')
  const [type, setType] = useState<string | null>(null)
  const noteType = type ?? writableTypes[0]?.value ?? ''
  const [moving, setMoving] = useState(false)

  // Copy-then-clear: the note is created FIRST and the legacy field is cleared
  // only once the server confirmed it, so no failure path can lose the text.
  const moveToNotes = async () => {
    if (!matchId || !remarks || !noteType || moving) return
    setMoving(true)
    try {
      await api.post(`/matches/${matchId}/notes`, { type: noteType, body: remarks })
    } catch (err) {
      notifyError(extractApiError(err, t('drawer.remarks.moveError')))
      setMoving(false)
      return
    }
    try {
      await save({ remarks: null })
      notifySuccess(t('drawer.remarks.moved'))
      onOpenNotes?.()
    } catch (err) {
      // The note exists — only clearing the old field failed, so the content is
      // now visible twice rather than lost. Say that instead of a generic error.
      notifyError(extractApiError(err, t('drawer.remarks.moveClearError')))
    } finally {
      setMoving(false)
    }
  }

  const blockStyle = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' } as const
  // Soft-tint notice (§4): warning-tinted surface, token icon, readable body text.
  const noticeStyle = {
    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px',
    background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
    borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
    fontSize: 11, color: 'var(--text)', lineHeight: 1.5,
  } as const
  // Soft-tint action button (§4 + house rule: an action is a BUTTON, never coloured text).
  const moveBtnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: moving ? 'default' : 'pointer',
    background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
    color: 'var(--color-primary-text)',
    border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
    opacity: moving ? 0.6 : 1,
  } as const

  // Retired field: nothing while the shared fetch runs, and nothing at all once it
  // is empty — that is the whole point of the merge (no second free-text field).
  if (loading || !remarks) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('drawer.remarks.title')}</span>
      </div>
      <div style={blockStyle}>
        {/* Honest, translated explanation that this field is going away (§3).
            role="note" (an annotation), not a live region — it is static on mount. */}
        <div style={noticeStyle} role="note">
          <AlertCircle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>{t('drawer.remarks.deprecated')}</span>
        </div>
        {/* The existing content, read-only — never an editor. */}
        <div style={{ padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
          <SafeHtml html={remarks} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
        </div>
        {/* One real move: pick the note type, then copy the text into a note. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <span id={typeLabelId} style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('notes.type')}</span>
          <SelectMenu aria-labelledby={typeLabelId} value={noteType} onChange={setType}
            placeholder={t('notes.type')} menuWidth={200}
            options={writableTypes.map(o => ({ value: o.value, label: o.label }))} />
          <button type="button" onClick={moveToNotes} disabled={moving || !matchId || !noteType} style={moveBtnStyle}>
            <ArrowRight size={13} aria-hidden="true" />
            {moving ? t('drawer.remarks.moving') : t('drawer.remarks.moveToNotes')}
          </button>
        </div>
      </div>
    </div>
  )
}
