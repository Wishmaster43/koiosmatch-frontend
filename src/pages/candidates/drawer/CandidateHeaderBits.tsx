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
import { BTN_H } from '@/config/buttonMetrics'
import CreatableSelect from '@/components/ui/CreatableSelect'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import type { Candidate } from '@/types/candidate'
import type { Id, LookupOption } from '@/types/common'
import type { HeaderForm } from '../hooks/useCandidateHeaderEdit'

const inputBase = { width: '100%', minWidth: 0, boxSizing: 'border-box' as const, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none' }
const iconBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0 } as const

// Title block: name + phase badge, or the name/function edit form. The status
// reason/return-date line was removed from the header (Danny 13/7: calm header) —
// that info lives in the status modal (re-pick the status), Voorkeuren and Tijdlijn.
export function CandidateTitle({ c, editing, hf, setHF, phaseInfo, showPhase }: {
  c: Candidate; editing: boolean
  hf: (k: keyof HeaderForm) => string; setHF: (k: keyof HeaderForm, v: string) => void
  phaseInfo: { label: string; color: string }; showPhase: boolean
}) {
  const { t } = useTranslation('candidates')
  const { functions, allowFreeEntry } = useFunctions() as { functions: Array<string | { value: string; label: string }>; allowFreeEntry: boolean }
  if (editing) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        <input placeholder={t('modal.fields.firstName')} value={hf('firstname')} onChange={e => setHF('firstname', e.target.value)}
          style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
        <input placeholder={t('modal.fields.lastName')} value={hf('lastname')} onChange={e => setHF('lastname', e.target.value)}
          style={{ ...inputBase, fontSize: 13, fontWeight: 600 }} />
      </div>
      <input placeholder={t('modal.fields.middleName')} value={hf('middleName')} onChange={e => setHF('middleName', e.target.value)}
        style={{ ...inputBase, fontSize: 12, color: 'var(--text-muted)' }} />
      <CreatableSelect value={hf('title')} options={functions} onChange={v => setHF('title', v)}
        allowCreate={allowFreeEntry} placeholder={t('columns.function')} menuWidth={260} />
    </div>
  )
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
        {/* Fase = colour-coded read-only badge (no picker); convert lives in the header actions. */}
        {showPhase && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999,
            background: phaseInfo.color + '1A', color: phaseInfo.color, border: `1px solid ${phaseInfo.color}55` }}>{phaseInfo.label}</span>
        )}
        {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
        <ReferenceNumberChip value={c.referenceNumber} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.title || '—'}</div>
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
          BTN_H (§4/§9, KANDIDAAT-100 #50): same explicit height as every other text/action
          button — this was the exact "Converteer naar Kandidaat" vs "+ Kandidaat" mismatch Danny flagged. */}
      {(isEntryPhase && nextPhase) ? (
        <button onClick={onConvert}
          style={{ display: 'flex', alignItems: 'center', gap: 4, height: BTN_H, padding: '0 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'white' }}>
          <UserCheck size={11} />{t('drawer.convertTo', { phase: nextPhase.label })}
        </button>
      ) : (
        <button disabled={cvGenerating || converting} onClick={downloadCv}
          style={{ display: 'flex', alignItems: 'center', gap: 4, height: BTN_H, padding: '0 10px', fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: (cvGenerating || converting) ? 'not-allowed' : 'pointer', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'white', opacity: (cvGenerating || converting) ? 0.7 : 1 }}>
          <Download size={11} />{cvGenerating ? t('drawer.generating') : t('drawer.downloadCv')}
        </button>
      )}
      {headerEditing ? (
        <>
          <button onClick={onSaveEdit} title={t('common:save')}
            style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
            <Save size={14} />
          </button>
          <button onClick={onCancelEdit} title={t('common:cancel')}
            style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <X size={14} />
          </button>
        </>
      ) : (
        <button onClick={onStartEdit} title={t('drawer.edit')}
          style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Edit2 size={13} />
        </button>
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
      color: 'var(--color-danger)', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-danger) 28%, transparent)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {inTrash
          ? [c.pendingEraseAt ? t('erase.inTrashSince', { date: formatDate(c.pendingEraseAt) }) : t('erase.inTrash'), c.archivedBy ? t('drawer.byWho', { name: c.archivedBy }) : null].filter(Boolean).join(' · ')
          : [c.archivedAt ? t('drawer.archivedOn', { date: formatDate(c.archivedAt) }) : t('drawer.archivedFlag'), c.archivedBy ? t('drawer.byWho', { name: c.archivedBy }) : null, c.archiveReason].filter(Boolean).join(' · ')}
      </span>
      {/* Herstellen (both states) */}
      {onRestore && (
        <button onClick={() => onRestore(c.id)} title={t('drawer.restore')} aria-label={t('drawer.restore')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-primary)' }}>
          <RotateCcw size={14} />
        </button>
      )}
      {/* Archived → move to trash (reversible); Trash → permanent delete (admin, preview popup).
          The confirm (or, when live applications/matches hang on the candidate, the
          ArchiveGuardModal) lives in useCandidateDrawerActions.markDeletionOne. */}
      {!inTrash && onMarkDeletion && (
        <button onClick={() => onMarkDeletion(c.id)}
          title={t('erase.markDelete')} aria-label={t('erase.markDelete')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-danger)' }}>
          <Trash2 size={14} />
        </button>
      )}
      {inTrash && onHardDelete && canHardDelete && (
        <button onClick={() => onHardDelete(c.id)}
          title={t('drawer.hardDelete')} aria-label={t('drawer.hardDelete')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--color-danger)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '3px 8px', color: '#fff', fontSize: 11, fontWeight: 600 }}>
          <Trash2 size={12} /> {t('erase.deleteForever')}
        </button>
      )}
    </div>
  )
}
