/**
 * MatchTextBlock — M17/optie A: a customer-facing "Matchtekst" rich-text
 * block on the Overview tab, cloned from MatchRemarksBlock (M29): own pencil
 * → RichTextEditor draft → save (diskette) / cancel (✕), SafeHtml display
 * otherwise. Shares the SAME useMatchContract data/save pair OverviewTab
 * already holds — no second GET.
 *
 * OFFERED-IFF-READ (ticket MATCH-TEXT-FIELD-1): the `match_text` column does
 * NOT exist on the backend yet, so this block renders ONLY when the fetched
 * match payload actually carried the `match_text` key (present, even if
 * null) — an absent key renders nothing. A PATCH the server silently drops
 * would be a fake affordance (§3); staying hidden until the key shows up in
 * the GET response is what keeps the save path honest.
 */
import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import { notifySuccess, notifyError } from '@/lib/notify'
import type { MatchContract } from '../hooks/useMatchContract'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helpers — accept any props at the boundary.
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

interface Props {
  value: string | null | undefined
  // Whether the GET /matches/{id} payload actually carried the `match_text`
  // key — false hides the whole block (OFFERED-IFF-READ, see file header).
  present: boolean
  loading: boolean
  save: (patch: Partial<MatchContract>) => Promise<void>
}

export default function MatchTextBlock({ value, present, loading, save }: Props) {
  const { t } = useTranslation('matches')

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  // Seed the draft once the fetch resolves (not on every render) — mirrors
  // MatchRemarksBlock's uncontrolled-then-synced pattern for a detail-only field.
  useEffect(() => { if (!loading) setDraft(value ?? '') }, [loading, value])

  const startEdit  = () => { setDraft(value ?? ''); setEditing(true) }
  const cancelEdit = () => { setDraft(value ?? ''); setEditing(false) }
  const saveEdit = async () => {
    try {
      await save({ match_text: draft || null })
      notifySuccess(t('drawer.matchText.saved'))
      setEditing(false)
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      notifyError(msg || t('drawer.matchText.saveError'))
    }
  }

  const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' } as const
  const blockStyle = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' } as const

  // OFFERED-IFF-READ: the backend column doesn't exist yet — stay hidden
  // entirely until the fetched payload actually carries the key.
  if (!present) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('drawer.matchText.title')}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={saveEdit} title={t('common:save')} aria-label={t('common:save')}
              style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
              <Save size={13} />
            </button>
            <button onClick={cancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}
              style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={startEdit} title={t('common:edit')} aria-label={t('common:edit')}
            style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <Edit2 size={13} />
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.contract.loading')}</div>
      ) : editing ? (
        <RichTextEditor value={draft} onChange={setDraft} />
      ) : value ? (
        <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
          <SafeHtml html={value} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
        </div>
      ) : (
        <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>—</div>
      )}
    </div>
  )
}
