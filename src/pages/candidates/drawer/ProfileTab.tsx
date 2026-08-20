import { useEffect, useRef, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X, Trash2, ExternalLink } from 'lucide-react'
import { useTextPopoutHost } from '@/hooks/useTextPopoutHost'
import RichTextEditorJs from '@/components/ui/RichTextEditor'
import SafeHtmlJs from '@/components/ui/SafeHtml'
// HUISSTIJL-1: the shared uppercase group-label atom (identity-only swap).
import { GroupLabel } from '@/components/ui/typography'
import ProfilePersonalTab from './ProfilePersonalTab'
import ProfileAddressTab from './ProfileAddressTab'
import ProfileContactTab from './ProfileContactTab'
import WorkPermitBlock from './WorkPermitBlock'
import CandidateOriginCard from './CandidateOriginCard'
import Button from '@/components/ui/Button'
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
export default function ProfileTab({ c, onEditSave, autoEditSignal, onContactMoment }: {
  c: Candidate; onEditSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number
  onContactMoment?: (v: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('candidates')

  const [summaryEditing, setSummaryEditing] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [summary, setSummary] = useState(c.summary ?? '')
  // Last PERSISTED profile text — what ✕ restores. Tracked separately from the
  // record prop because the popped-out window can save this field while the
  // drawer's own copy of the candidate is still the pre-save one.
  const [savedSummary, setSavedSummary] = useState(c.summary ?? '')
  const saveSummary   = () => { onEditSave?.({ summary }); setSavedSummary(summary); setSummaryEditing(false) }
  const cancelSummary = () => { setSummary(savedSummary); setSummaryEditing(false) }

  // TEKST-POPOUT-1 (Danny 08-08 punt 2) — the profile text gets the notes' own
  // second-screen affordance: the SAME window.open mechanism, one icon in this
  // block's title row and nothing else moved (this drill-down is frozen). Both
  // windows edit one draft: local edits are published, the other window's edits
  // are adopted, and a save on either side ends the edit here.
  const popout = useTextPopoutHost({
    entity: 'candidate', id: c.id, field: 'summary', value: summary, dirty: summary !== savedSummary,
    onDraft: html => { setSummary(html); setSummaryEditing(true) },
    onSaved: html => { setSummary(html); setSavedSummary(html); setSummaryEditing(false) },
  })
  // Publish every local edit (typing, dictation, applied Koios suggestion).
  const changeSummary = (html: string) => { setSummary(html); popout.publishDraft(html) }
  // Open the second screen; editing starts here too, so the two windows show one
  // and the same draft and closing the popout can never strand unsaved text.
  const openSummaryPopout = () => { setSummaryEditing(true); popout.open() }

  // Adopt the record's value only when the RECORD ITSELF changes (a reload, a
  // save elsewhere) and no edit is in progress — comparing against the last seen
  // record value, so text saved from the popped-out window is not overwritten by
  // this drawer's now-stale copy.
  const lastRecordSummary = useRef(c.summary ?? '')
  useEffect(() => {
    const next = c.summary ?? ''
    if (next === lastRecordSummary.current) return
    lastRecordSummary.current = next
    setSavedSummary(next)
    if (!summaryEditing) setSummary(next)
  }, [c.summary, summaryEditing])

  const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
  const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
  const editControls = (isEditing: boolean, onSave: () => void, onCancel: () => void, onStart: () => void) => isEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <Button variant="primary" size="sm" iconOnly onClick={onSave} title={t('common:save')} aria-label={t('common:save')}>
        <Save size={13} />
      </Button>
      <Button variant="secondary" size="sm" iconOnly onClick={onCancel} title={t('common:cancel')} aria-label={t('common:cancel')}>
        <X size={13} />
      </Button>
    </div>
  ) : (
    <Button variant="secondary" size="sm" iconOnly onClick={onStart} title={t('common:edit')} aria-label={t('common:edit')}>
      <Edit2 size={13} />
    </Button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Profile fields — three stacked cards, one pencil each. All mounted, so
             editing one never discards another's draft. Order matches the old
             single-card layout: Persoonlijk, Adres, Contact. ── */}
      <ProfilePersonalTab c={c} onSave={onEditSave} autoEditSignal={autoEditSignal} />
      {/* KAND-WERKVERGUNNING-2: only renders for a non-EU/EEA candidate — see the
          component's own doc comment for the visibility rule + data-plumbing status. */}
      <WorkPermitBlock    c={c} onSave={onEditSave} autoEditSignal={autoEditSignal} />
      <ProfileAddressTab  c={c} onSave={onEditSave} autoEditSignal={autoEditSignal} />
      <ProfileContactTab  c={c} onSave={onEditSave} autoEditSignal={autoEditSignal} onContactMoment={onContactMoment} />
      {/* Herkomst last: it describes the DOSSIER (source + who created it, when),
          not the person, so it reads after the person's own fields. */}
      <CandidateOriginCard c={c} />

      {/* ── Profile text — same rich editor as Notes (formatting + HTML toggle + expand) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          {/* HUISSTIJL-1: identical 11/600/uppercase render, letterSpacing kept at
              this block's own 0.04em (atom default is 0.05em) via the style override. */}
          <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{t('profile.summary')}</GroupLabel>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* Clear the profile text (edit mode only) — through the same publish
                path as typing, so a popped-out window clears with it.
                HUISSTIJL-1: neutral border + danger-coloured icon is a hybrid that
                matches neither `secondary` (needs neutral text) nor `dangerSoft`
                (needs a danger-tinted bg/border) — left as its own bespoke style. */}
            {summaryEditing && (
              <button onClick={() => changeSummary('')} title={t('profile.clear')} aria-label={t('profile.clear')}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- bespoke neutral-border/danger-icon hybrid, matches neither secondary nor dangerSoft (see comment above)
                style={{ ...iconBtn, width: 28, height: 28, background: 'none', color: 'var(--color-danger-text)', border: '1px solid var(--border)' }}>
                <Trash2 size={13} />
              </button>
            )}
            {/* Second screen — same icon + footprint the notes popup uses for its
                own pop-out, in this block's own title row. */}
            <Button variant="secondary" size="sm" iconOnly onClick={openSummaryPopout} title={t('common:openSecondScreen')} aria-label={t('common:openSecondScreen')}>
              <ExternalLink size={13} />
            </Button>
            {editControls(summaryEditing, saveSummary, cancelSummary, () => setSummaryEditing(true))}
          </div>
        </div>
        {summaryEditing
          ? <RichTextEditor value={summary} onChange={changeSummary}
              expanded={summaryExpanded} onToggleExpand={() => setSummaryExpanded(v => !v)}
              // KOIOS-GENERATE-1 (Danny 09-08): the profile text also offers
              // "Genereer met Koios" — Actiepunten stays off via the shared
              // improve+summarize-only default (ACTIONS-SCOPE-DEFAULT-FLIP).
              assistGenerate={{ entity: 'candidate', id: String(c.id) }} />
          : (summary
              ? <div style={{ ...blockStyle, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
                  <SafeHtml html={summary} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
                </div>
              : <div style={{ ...blockStyle, padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>-</div>)}
      </div>

      {/* Tenant custom fields — only renders when definitions exist */}
    </div>
  )
}
