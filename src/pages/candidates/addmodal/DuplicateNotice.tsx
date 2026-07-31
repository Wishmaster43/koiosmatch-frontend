/**
 * DuplicateNotice — the panel that replaces the old dead end. A duplicate used to
 * surface as the raw Dutch server sentence ("Kandidaat of lead bestaat al") with
 * the `existing` payload thrown away; this shows WHO it is, WHAT STATE it is in
 * (DUP-ARCHIVED-1) and gives real actions: open the record, or restore-and-open
 * when it is archived and the user may restore.
 *
 * Pure presentational: match + flags in, callbacks out. It shows the name and the
 * archived/active state only — never the rest of the payload (§8).
 *
 * NOT offered here: merge. POST /candidates/{survivor}/merge needs TWO existing
 * records and the create was refused, so nothing exists to merge from — a merge
 * button on this panel would be a fake affordance (§3). Merging stays where two
 * real records exist: the drawer / bulk MergeCandidateModal.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ExternalLink, RotateCcw, Loader2 } from 'lucide-react'
import SoftChip from '@/components/ui/SoftChip'
import { BTN_H } from '@/config/buttonMetrics'
import type { DuplicateMatch } from './useDuplicateProbe'

interface DuplicateNoticeProps {
  match: DuplicateMatch
  /** 'blocked' = the server refused the create (409); 'warning' = the live probe found one. */
  variant: 'blocked' | 'warning'
  /** Restore is authorization-gated (candidates.update); the backend re-checks. */
  canRestore: boolean
  restoring: boolean
  onOpen: () => void
  onRestore: () => void
  onDismiss: () => void
}

export default function DuplicateNotice({ match, variant, canRestore, restoring, onOpen, onRestore, onDismiss }: DuplicateNoticeProps) {
  const { t } = useTranslation('candidates')
  const blocked = variant === 'blocked'
  // A refused create is danger; a live probe hit is a warning — tokens only (§4).
  const tone = blocked ? 'var(--color-danger)' : 'var(--color-warning)'
  const archived = match.archived === true
  const name = (match.name ?? '').trim() || t('duplicate.unnamed')

  const actionBtn = (base = false) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px',
    fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
    border: base ? '1px solid var(--border)' : `1px solid color-mix(in srgb, ${tone} 45%, transparent)`,
    background: base ? 'var(--surface)' : `color-mix(in srgb, ${tone} 12%, transparent)`,
    color: base ? 'var(--text)' : tone,
  } as const)

  return (
    // Blocked follows an action the user just took → assertive; the probe is ambient → polite.
    <div role={blocked ? 'alert' : 'status'}
      style={{ margin: '0 24px 8px', padding: '10px 14px', borderRadius: 8,
        background: `color-mix(in srgb, ${tone} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone} 40%, transparent)` }}>

      {/* Headline: what happened, in the user's language — never the server sentence. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: tone, fontSize: 12, fontWeight: 600 }}>
        <AlertTriangle size={14} aria-hidden="true" />
        {blocked ? t('duplicate.blockedTitle') : t('duplicate.warningTitle')}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4, lineHeight: 1.5 }}>
        {blocked ? t('duplicate.blockedBody') : t('duplicate.warningBody')}
      </div>

      {/* The duplicate itself: name + state chip, nothing more (§8 data minimisation). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
        <SoftChip color={archived ? 'var(--color-warning)' : 'var(--color-success)'}
          label={archived ? t('duplicate.stateArchived') : t('duplicate.stateActive')} />
      </div>
      {archived && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{t('duplicate.archivedHint')}</div>
      )}

      {/* Real actions only — every button below has a route behind it. */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onOpen} style={actionBtn()}>
          <ExternalLink size={13} aria-hidden="true" /> {t('duplicate.open')}
        </button>
        {archived && canRestore && (
          <button type="button" onClick={onRestore} disabled={restoring}
            style={{ ...actionBtn(), cursor: restoring ? 'not-allowed' : 'pointer', opacity: restoring ? 0.6 : 1 }}>
            {restoring ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RotateCcw size={13} aria-hidden="true" />}
            {restoring ? t('duplicate.restoring') : t('duplicate.restoreAndOpen')}
          </button>
        )}
        <button type="button" onClick={onDismiss} style={actionBtn(true)}>
          {t('duplicate.editData')}
        </button>
      </div>
    </div>
  )
}
