/**
 * MatchTextBlock — M17/optie A: a customer-facing "Matchtekst" rich-text
 * block on the Overview tab, cloned from MatchRemarksBlock (M29): own pencil
 * → RichTextEditor draft → save (diskette) / cancel (✕), SafeHtml display
 * otherwise. Shares the SAME useMatchContract data/save pair OverviewTab
 * already holds — no second GET.
 *
 * OFFERED-IFF-READ (ticket MATCH-TEXT-FIELD-1): this block renders ONLY when
 * the fetched match payload actually carried the `match_text` key (present,
 * even if null) — an absent key renders nothing. A PATCH the server silently
 * drops would be a fake affordance (§3). Measured live 09-08: the column now
 * EXISTS — GET /matches/{id} returns `match_text` and PATCH /matches/{id}
 * persists it — so the gate passes today and the guard stays only as the
 * safety net for a backend that lacks the column.
 *
 * REMARKS-INTO-NOTES-1 (Danny 09-08): this is now the match's ONE free-text
 * field. The old second field, Opmerkingen (`remarks`), is retired — its
 * content belongs in Notes (author/date/type/channel + timeline); see
 * MatchRemarksBlock's header.
 *
 * KOIOS-ASSIST-TEXTFIELDS (Danny 08-08): the dictation mic + Koios assist now
 * come from the SHARED RichTextAssistBar inside RichTextEditor's own toolbar —
 * the same two icons every description field in the app carries. The
 * match-only MatchAssistSection/useMatchTextAssist/matchAssistApi trio this
 * block used to mount was a copy of that pattern and is gone (§11: the shared
 * helper landed WITH adoption).
 *
 * CORRECTION (Danny 09-08, supersedes the 08-08 "403 for everyone" line above):
 * that permission-gate bug is fixed (backend commit 456ac45b, KOIOS-GENERATE-1)
 * — POST /ai/koios/generate is a real, working endpoint now, not a dead end.
 * Measured live 09-08: this tenant's own call answers 402 `koios_credit_exhausted`
 * (the Koios credit balance is empty), an account state, not a rights problem.
 * See richTextAssistApi.ts's header for the full measured contract. This block
 * still doesn't pass `assistGenerate` (no Generate button here) — that is a
 * separate, not-yet-decided step.
 *
 * A match text is a description of the placement, not a conversation, so it
 * never opts into "Actiepunten" — it just rides RichTextAssistBar's own
 * improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP), no per-field
 * override needed.
 */
import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, ExternalLink } from 'lucide-react'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'
import { notifySuccess, notifyError } from '@/lib/notify'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
import type { Id } from '@/types/common'
import type { MatchContract } from '../hooks/useMatchContract'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helpers — accept any props at the boundary.
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

interface Props {
  // For the second-screen popout (TEKST-POPOUT-1) — the match this text belongs to.
  matchId?: Id
  value: string | null | undefined
  // Whether the GET /matches/{id} payload actually carried the `description`
  // key — false hides the whole block (OFFERED-IFF-READ, see file header).
  present: boolean
  loading: boolean
  save: (patch: Partial<MatchContract>) => Promise<void>
}

// The match's free-text block, rich-text editable and second-screen pop-outable
// like the candidate profile text (mirrors useVacancyDescription's idiom).
export default function MatchTextBlock({ matchId, value, present, loading, save }: Props) {
  const { t } = useTranslation('matches')

  const [editing, setEditing] = useState(false)
  // P34-expand: local expand state, same idiom as OpportunityDescriptionBlock —
  // grows the editor's min-height 120→320 via RichTextEditor's own expanded prop.
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  // What the read-only branch shows: follows the prop, but a save from the
  // popped-out window updates it immediately (the prop only refreshes on the
  // next contract fetch) — mirrors useVacancyDescription's savedDescription.
  const [shown, setShown] = useState<string | null | undefined>(value)
  // Seed the draft once the fetch resolves (not on every render) — mirrors
  // MatchRemarksBlock's uncontrolled-then-synced pattern for a detail-only field.
  useEffect(() => { if (!loading) { setShown(value); setDraft(value ?? '') } }, [loading, value])

  // TEKST-POPOUT-1: the profile-text second-screen affordance, one shared draft
  // between drawer and popped-out window (mirrors useVacancyDescription).
  const popout = useTextPopoutHost({
    entity: 'match', id: matchId != null ? String(matchId) : '', field: 'text', value: draft, dirty: editing && draft !== (shown ?? ''),
    onDraft: (html: string) => { setDraft(html); setEditing(true) },
    onSaved: (html: string) => { setDraft(html); setShown(html); setEditing(false) },
  })
  const changeDraft = (html: string) => { setDraft(html); popout.publishDraft(html) }
  const openPopout = () => { if (matchId == null) return; setEditing(true); popout.open() }

  const startEdit  = () => { setDraft(shown ?? ''); setEditing(true) }
  const cancelEdit = () => { setDraft(shown ?? ''); setEditing(false) }
  // Persists the draft as the renamed `description` wire key (CMBE b87e3240).
  const saveEdit = async () => {
    try {
      await save({ description: draft || null })
      notifySuccess(t('drawer.matchText.saved'))
      setEditing(false)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notifyError(msg || t('drawer.matchText.saveError'))
    }
  }

  const blockStyle = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' } as const

  // OFFERED-IFF-READ: the backend column doesn't exist yet — stay hidden
  // entirely until the fetched payload actually carries the key.
  if (!present) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <GroupLabel>{t('drawer.matchText.title')}</GroupLabel>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button variant="primary" iconOnly size="sm" onClick={saveEdit} title={t('common:save')} aria-label={t('common:save')}>
              <Save size={13} />
            </Button>
            <Button variant="secondary" iconOnly size="sm" onClick={cancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}>
              <X size={13} />
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
          {matchId != null && (
            <Button variant="secondary" iconOnly size="sm" onClick={openPopout}
              title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}>
              <ExternalLink size={13} />
            </Button>
          )}
          <Button variant="secondary" iconOnly size="sm" onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}>
            <Edit2 size={13} />
          </Button>
          </div>
        )}
      </div>
      {loading ? (
        <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.contract.loading')}</div>
      ) : editing ? (
        <RichTextEditor value={draft} onChange={changeDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} />
      ) : shown ? (
        <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
          <SafeHtml html={shown} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
        </div>
      ) : (
        <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>
      )}
    </div>
  )
}
