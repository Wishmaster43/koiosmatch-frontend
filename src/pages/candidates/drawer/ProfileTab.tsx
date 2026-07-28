import { useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2 } from 'lucide-react'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
import ProfilePersonalTab from './ProfilePersonalTab'
import ProfileAddressTab from './ProfileAddressTab'
import ProfileContactTab from './ProfileContactTab'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// Still-untyped JS UI helpers — accept any props at the boundary.
const RichTextEditor = RichTextEditorJs as unknown as ComponentType<AnyProps>
const SafeHtml = SafeHtmlJs as unknown as ComponentType<AnyProps>

/** Profile tab — ONE tab (as it has always been), stacking three independently
 *  editable cards: Persoonlijk / Adres / Contact, each with its own pencil.
 *
 *  Danny 28-07: the old single pencil flipped ~15 fields at once ("ruk om te
 *  onderhouden"), so the edit state was split per card. A sub-tab strip was tried
 *  first and rejected the same day — this drawer is the house BLUEPRINT (§3A) and
 *  its layout should not change; only the "whole form opens at once" behaviour had
 *  to go. Keeping all three mounted also means switching cards mid-edit can no
 *  longer discard a draft, which the sub-tab version did.
 *
 *  The profile TEXT block keeps its own separate pencil below, exactly as before;
 *  the Koios AI advice block lives one level up in ProfilePanel.tsx, unaffected. */
export default function ProfileTab({ c, onEditSave, autoEditSignal }: { c: Candidate; onEditSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number }) {
  const { t } = useTranslation('candidates')

  const [summaryEditing, setSummaryEditing] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [summary, setSummary] = useState(c.summary ?? '')
  const saveSummary   = () => { onEditSave?.({ summary }); setSummaryEditing(false) }
  const cancelSummary = () => { setSummary(c.summary ?? ''); setSummaryEditing(false) }

  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
  const editControls = (isEditing: boolean, onSave: () => void, onCancel: () => void, onStart: () => void) => isEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={onSave} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
        <Save size={13} />
      </button>
      <button onClick={onCancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        <X size={13} />
      </button>
    </div>
  ) : (
    <button onClick={onStart} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      <Edit2 size={13} />
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Profile fields — three stacked cards, one pencil each. All mounted, so
             editing one never discards another's draft. Order matches the old
             single-card layout: Persoonlijk, Adres, Contact. ── */}
      <ProfilePersonalTab c={c} onSave={onEditSave} autoEditSignal={autoEditSignal} />
      <ProfileAddressTab  c={c} onSave={onEditSave} autoEditSignal={autoEditSignal} />
      <ProfileContactTab  c={c} onSave={onEditSave} autoEditSignal={autoEditSignal} />

      {/* ── Profile text — same rich editor as Notes (formatting + HTML toggle + expand) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('profile.summary')}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* Clear the profile text (edit mode only). */}
            {summaryEditing && (
              <button onClick={() => setSummary('')} title={t('profile.clear')} aria-label={t('profile.clear')}
                style={{ ...iconBtn, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--border)' }}>
                <Trash2 size={13} />
              </button>
            )}
            {editControls(summaryEditing, saveSummary, cancelSummary, () => setSummaryEditing(true))}
          </div>
        </div>
        {summaryEditing
          ? <RichTextEditor value={summary} onChange={setSummary}
              expanded={summaryExpanded} onToggleExpand={() => setSummaryExpanded(v => !v)} />
          : (c.summary
              ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
                  <SafeHtml html={c.summary} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
                </div>
              : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>-</div>)}
      </div>

      {/* Tenant custom fields — only renders when definitions exist */}
    </div>
  )
}
