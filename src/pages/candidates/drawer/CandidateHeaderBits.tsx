/**
 * CandidateHeaderBits — the presentational pieces of the candidate drawer
 * header (§0.3 split from CandidateDrawer): the title block (view + edit),
 * the header actions (convert / CV download / edit toggles) and the archived
 * banner. Pure rendering; all state and mutations come in via props.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Edit2, RotateCcw, Save, Trash2, UserCheck, X } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from '../CandidateCvTemplate'
import type { CvCandidate } from '../CandidateCvTemplate'
import { useCvSettings } from '@/lib/useCvSettings'
import { useLocale, useDateFormat } from '@/lib/datetime'
import { useFunctions } from '@/lib/useFunctions'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import DetachedCountBadge from '@/components/ui/DetachedCountBadge'
import LookupIcon from '@/components/ui/LookupIcon'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { PageTitle } from '@/components/ui/typography'
import { chipInk, tintBg, tintBorder } from '@/lib/tint'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'
import type { HeaderForm } from '../hooks/useCandidateHeaderEdit'

// Canon field style (G33/fieldMetrics) — was its own padding-6/radius-6 copy;
// `minWidth: 0` stays local since it only matters inside this header's grid.
const inputBase = { ...fieldInputStyle, minWidth: 0 }

// Title block: name + phase badge, or the name/function edit form. The status
// reason/return-date line was removed from the header (Danny 13/7: calm header) —
// that info lives in the status modal (re-pick the status), Voorkeuren and Tijdlijn.
// The phase chip — SoftChip + the lookup's own icon (§6: never colour-only).
// Rendered as the DRAWER TITLE label since 19-08 (Danny: "Kandidaat staat dubbel
// in de drill down"): the static entity label and this chip said the same word
// twice, and for a Lead the static label was even wrong. One chip, one spot.
export function PhaseChip({ phaseInfo }: { phaseInfo: { label: string; color: string; icon?: string } }) {
  return (
    <SoftChip color={phaseInfo.color} round label={
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {phaseInfo.icon && <LookupIcon icon={phaseInfo.icon} size={11} />}
        {phaseInfo.label}
      </span>
    } />
  )
}

// Name + phase-chip view, or the name/function edit form when `editing` is true
// (see file docblock above) — purely presentational, state lives in the caller.
export function CandidateTitle({ c, editing, hf, setHF }: {
  c: Candidate; editing: boolean
  hf: (k: keyof HeaderForm) => string; setHF: (k: keyof HeaderForm, v: string) => void
}) {
  const { t } = useTranslation('candidates')
  // DEMO-TAAL-1: pair the raw stored function name with its translated label for the
  // picker, and translate the read-only subtitle the same way (seeded default only).
  const { functionOptions, allowFreeEntry } = useFunctions()
  const seedLabel = useSeedLabel()
  if (editing) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        <input placeholder={t('modal.fields.firstName')} value={hf('firstname')} onChange={e => setHF('firstname', e.target.value)}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- name edit <input> matching the bold PageTitle it replaces while editing, not a SectionTitle heading
          style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
        <input placeholder={t('modal.fields.lastName')} value={hf('lastname')} onChange={e => setHF('lastname', e.target.value)}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- name edit <input> matching the bold PageTitle it replaces while editing, not a SectionTitle heading
          style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
      </div>
      {/* The tussenvoegsel is part of the NAME, so it carries the same weight as
          the first/last name beside it (Danny 17-08: "Van moet ook dik gedrukt") —
          it used to render a size smaller and muted, which read as a side note. */}
      <input placeholder={t('modal.fields.middleName')} value={hf('middleName')} onChange={e => setHF('middleName', e.target.value)}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- name edit <input> matching the bold PageTitle it replaces while editing, not a SectionTitle heading
        style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
      <CreatableSelect value={hf('title')} options={functionOptions} onChange={v => setHF('title', v)}
        allowCreate={allowFreeEntry} placeholder={t('columns.function')} menuWidth={260} />
    </div>
  )
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <PageTitle as="span" style={{ fontWeight: 700 }}>{c.name}</PageTitle>
        {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
        <ReferenceNumberChip value={c.referenceNumber} />
        {/* ONTKOPPEL-TELLER-1: whole-history CURRENTLY-detached count, warning-only (hidden at 0). */}
        <DetachedCountBadge count={c.detachedCount} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.title ? seedLabel('functions', { label: c.title }) : '—'}</div>
    </>
  )
}

// Header actions: convert (entry phase) or CV download, plus the edit/save/cancel toggles.
export function CandidateHeaderActions({ c, isEntryPhase, nextPhase, converting, onConvert, headerEditing, onStartEdit, onSaveEdit, onCancelEdit }: {
  c: Candidate; isEntryPhase: boolean; nextPhase?: LookupOption; converting: boolean
  onConvert: () => void; headerEditing: boolean
  onStartEdit: () => void; onSaveEdit: () => void; onCancelEdit: () => void
}) {
  const { t } = useTranslation('candidates')
  const { settings: cvSettings } = useCvSettings() as { settings?: unknown }
  const locale = useLocale() as string
  const [cvGenerating, setCvGenerating] = useState(false)

  // Generate + download the CV PDF client-side (react-pdf; no server round-trip).
  const downloadCv = async () => {
    setCvGenerating(true)
    try {
      const blob = await pdf(<CvDocument c={c as unknown as CvCandidate} settings={cvSettings as never} locale={locale} t={t} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `CV - ${c?.name ?? 'candidate'}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } finally { setCvGenerating(false) }
  }

  return (
    <>
      {/* Entry phase (Lead) → prominent convert (CV is illogical for a lead); else → download CV.
          size="sm" (Danny 19-08): flush with the pencil/save trio beside it — md
          towered 6px over its own row. */}
      {(isEntryPhase && nextPhase) ? (
        <Button variant="primary" size="sm" onClick={onConvert}>
          <UserCheck size={11} />{t('drawer.convertTo', { phase: nextPhase.label })}
        </Button>
      ) : (
        <Button variant="primary" size="sm" disabled={cvGenerating || converting} onClick={downloadCv}>
          <Download size={11} />{cvGenerating ? t('drawer.generating') : t('drawer.downloadCv')}
        </Button>
      )}
      {headerEditing ? (
        <>
          <Button variant="primary" size="sm" iconOnly onClick={onSaveEdit} title={t('common:save')} aria-label={t('common:save')}>
            <Save size={14} />
          </Button>
          <Button variant="secondary" size="sm" iconOnly onClick={onCancelEdit} title={t('common:cancel')} aria-label={t('common:cancel')}>
            <X size={14} />
          </Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" iconOnly onClick={onStartEdit} title={t('drawer.edit')} aria-label={t('drawer.edit')}>
          <Edit2 size={13} />
        </Button>
      )}
    </>
  )
}

// Archived/trash banner: when/by whom/why + restore, move-to-trash and hard delete
// (admin-only; the backend re-checks and 403s/409s — §7 UI gating is UX only).
export function ArchivedBanner({ c, canHardDelete, onRestore, onMarkDeletion, onHardDelete }: {
  c: Candidate; canHardDelete: boolean
  onRestore?: (id: Id) => void; onMarkDeletion?: (id: Id) => void; onHardDelete?: (id: Id) => void
}) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat() as { formatDate: (d?: string | null) => string }
  const inTrash = c.lifecycle === 'pending_erase'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: chipInk('var(--color-danger)'), background: tintBg('var(--color-danger)'),
      border: tintBorder('var(--color-danger)') }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {inTrash
          ? [c.pendingEraseAt ? t('erase.inTrashSince', { date: formatDate(c.pendingEraseAt) }) : t('erase.inTrash'), c.archivedBy ? t('drawer.byWho', { name: c.archivedBy }) : null].filter(Boolean).join(' · ')
          : [c.archivedAt ? t('drawer.archivedOn', { date: formatDate(c.archivedAt) }) : t('drawer.archivedFlag'), c.archivedBy ? t('drawer.byWho', { name: c.archivedBy }) : null, c.archiveReason].filter(Boolean).join(' · ')}
      </span>
      {/* Herstellen (both states) — HUISSTIJL-1: bare borderless icon (ghost
          identity), not one of the four migrated Button patterns, left as-is. */}
      {onRestore && (
        <button onClick={() => onRestore(c.id)} title={t('drawer.restore')} aria-label={t('drawer.restore')}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- pre-existing bespoke icon-only control (mirrors PendingEraseBanner's icon variant), out of this task's scope
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-primary-text)' }}>
          <RotateCcw size={14} />
        </button>
      )}
      {/* Archived → move to trash (reversible); Trash → permanent delete (admin, preview popup).
          The confirm (or, when live applications/matches hang on the candidate, the
          ArchiveGuardModal) lives in useCandidateDrawerActions.markDeletionOne.
          HUISSTIJL-1: same bare borderless ghost identity as Herstellen above — left as-is. */}
      {!inTrash && onMarkDeletion && (
        <button onClick={() => onMarkDeletion(c.id)}
          title={t('erase.markDelete')} aria-label={t('erase.markDelete')}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- pre-existing bespoke icon-only control (mirrors PendingEraseBanner's icon variant), out of this task's scope
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-danger-text)' }}>
          <Trash2 size={14} />
        </button>
      )}
      {inTrash && onHardDelete && canHardDelete && (
        <Button variant="danger" size="sm" onClick={() => onHardDelete(c.id)}
          title={t('drawer.hardDelete')} aria-label={t('drawer.hardDelete')}>
          <Trash2 size={12} /> {t('erase.deleteForever')}
        </Button>
      )}
    </div>
  )
}
