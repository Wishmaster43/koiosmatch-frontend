import { useState } from 'react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import DatePicker from 'react-datepicker'
import { useDateFormat } from '@/lib/datetime'
import { toLocalIsoDate } from '@/lib/localDate'
import { useWorkPermitTypes } from '@/lib/useWorkPermitTypes'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import { FieldRow, EditControls, GroupCard, GroupHeader, inputStyle } from './profileFieldShared'
import { useWorkPermitVisibility } from './useWorkPermitVisibility'
import type { WorkPermitDataState } from './workPermitVisibility'
import type { Candidate } from '@/types/candidate'

type AnyProps = Record<string, unknown>
// CreatableSelect is still untyped JS — accept any props at the boundary (mirrors ProfilePersonalTab).
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

// The fields this card owns — mirrors ProfilePersonalTab's per-card split (own
// pencil, own draft/error state, never blocking another card's in-progress edit).
type WPKey = 'workPermitType' | 'workPermitValidUntil'
type WPForm = Record<WPKey, string>

/**
 * WorkPermitBlock — KAND-WERKVERGUNNING-2: work-permit fields backed by two plain
 * backend columns (candidates.work_permit_type / work_permit_valid_until — see the
 * candidates migration, CandidateProfileRequest and WorkPermitGuard).
 *
 * DANNY-PUNT-1 (2026-08-09): the card is hidden ONLY when it is empty AND the
 * candidate's nationality provably resolves to the company's own country — for a
 * Dutch candidate at a Dutch company the block was pure noise. Every unknown keeps
 * it visible, and a card that already holds a permit type or validity date is NEVER
 * hidden regardless of nationality (residence-right data must stay reachable). The
 * rule, and the live API measurements it rests on, live in `workPermitVisibility.ts`;
 * `useWorkPermitVisibility` feeds it. This replaces the old non-EU-only gate.
 *
 * KAND-WERKVERGUNNING-LOOKUP-1 (2026-08-08): `work_permit_type` moved from
 * free text onto a tenant lookup (GET /work-permit-types, useWorkPermitTypes) —
 * the stale "no controlled vocabulary" claim this docblock used to carry is
 * corrected here. The field is a pick-only (allowCreate=false) type-to-filter
 * dropdown over that lookup, mirrors ProfilePersonalTab's gender/nationality
 * fields exactly — never a plain <select> (CLAUDE.md §4 standing rule: always a
 * searchable dropdown). Verified live against koiosmatch-api: PATCH
 * /candidates/{id} still takes the plain slug STRING on `work_permit_type`
 * (CandidateProfileRequest validates it with `Rule::exists('work_permit_types',
 * 'value')`, not an id) — so the option `value` sent on save is that same slug,
 * no shape change needed on candidatesShared.ts's buildCandidatePatch (already
 * forwards `workPermitType` → `work_permit_type` unchanged). A legacy/unknown
 * slug already stored (no longer present in the tenant's lookup) still renders
 * as-is via the raw-string fallback below — never silently blanked — same
 * tolerance as ProfilePersonalTab's gender/nationality display.
 *
 * `work_permit_valid_until` is unaffected by the lookup move and keeps its own
 * plain date column + DatePicker, untouched here.
 */
export default function WorkPermitBlock({ c, onSave, autoEditSignal }: {
  c: Candidate; onSave?: (v: Record<string, unknown>) => void; autoEditSignal?: number
}) {
  const { t } = useTranslation('candidates')
  const { formatDate } = useDateFormat()
  // Work-permit kind now comes from a tenant lookup (KAND-WERKVERGUNNING-LOOKUP-1),
  // never a hardcoded option list — see the docblock above.
  const { workPermitTypes } = useWorkPermitTypes()

  // mapCandidate.ts does not map work_permit_type/work_permit_valid_until onto the
  // typed Candidate model (re-measured 09-08: none of the four key variants survives
  // the mapper, so in production BOTH read empty even when the API has values — a
  // pre-existing display gap, owned by the mapper, reported not silently patched
  // here). Read the (future) camelCase keys and the raw snake_case ones, whichever
  // is present. Mirrors the identical pattern in BackgroundTab.tsx's `references`.
  const raw = c as unknown as {
    workPermitType?: string | null; workPermitValidUntil?: string | null
    work_permit_type?: string | null; work_permit_valid_until?: string | null
  }
  const currentType = raw.workPermitType ?? raw.work_permit_type ?? ''
  const currentValidUntil = raw.workPermitValidUntil ?? raw.work_permit_valid_until ?? ''

  // DANNY-PUNT-1: classify the card as filled / empty / unobservable, because only a
  // provably EMPTY card may ever be hidden. When the candidate object carries none of
  // the four key variants the mapper has dropped them (measured 09-08), so we cannot
  // tell whether a permit exists — that is 'unobservable' and keeps the card visible,
  // never a silent "empty". See the WorkPermitDataState docs for the full reasoning.
  const permitKeys = ['workPermitType', 'work_permit_type', 'workPermitValidUntil', 'work_permit_valid_until'] as const
  const asRecord = c as unknown as Record<string, unknown>
  const observable = permitKeys.some(k => k in asRecord)
  const dataState: WorkPermitDataState = !observable
    ? 'unobservable'
    : (currentType || currentValidUntil) ? 'filled' : 'empty'
  const visible = useWorkPermitVisibility(c.nationality, dataState)

  const emptyForm = (): WPForm => ({ workPermitType: currentType, workPermitValidUntil: currentValidUntil })
  const [editing, setEditing] = useState(false)
  // Open edit mode when the parent bumps the signal (mirrors ProfilePersonalTab —
  // e.g. right after Lead→Kandidaat convert, every card opens together).
  const [prevAutoEdit, setPrevAutoEdit] = useState(autoEditSignal ?? 0)
  if ((autoEditSignal ?? 0) !== prevAutoEdit) { setPrevAutoEdit(autoEditSignal ?? 0); setEditing(true) }
  const [form, setForm] = useState<WPForm>(emptyForm)
  const setF = (k: WPKey, v: string) => setForm(p => ({ ...p, [k]: v }))

  // Both fields are optional (no tenant-required flag exists for these — the
  // backend's own guard, WorkPermitGuard, only fires at match-creation time).
  const save = () => { onSave?.(form); setEditing(false) }
  const cancel = () => { setForm(emptyForm()); setEditing(false) }

  // Empty card + a nationality that provably matches the company's own country →
  // nothing to ask (calm by default, §3B). Every other case stays visible.
  if (!visible) return null

  const renderInput = (key: WPKey) => {
    if (key === 'workPermitValidUntil') return (
      <DatePicker
        selected={(() => { try { const d = form.workPermitValidUntil ? new Date(form.workPermitValidUntil) : null; return d && !isNaN(d.getTime()) ? d : null } catch { return null } })()}
        // Local calendar day, never `.toISOString()` — a permit expiry off by a day is a
        // document someone relies on being wrong (CLAUDE.md fix task 09-08).
        onChange={(d: Date | null) => setF('workPermitValidUntil', d ? toLocalIsoDate(d) : '')}
        dateFormat="dd-MM-yyyy"
        showMonthDropdown showYearDropdown dropdownMode="select"
        placeholderText={t('profile.selectDate')}
        portalId="datepicker-portal"
        popperPlacement="bottom-start"
        customInput={<input style={inputStyle} />}
      />
    )
    // Pick-only (allowCreate=false) type-to-filter dropdown over the tenant lookup —
    // never a plain <select> (CLAUDE.md §4 standing rule). Sends the option's
    // `value` (the same lookup slug PATCH validates), mirrors ProfilePersonalTab's
    // gender/nationality fields exactly.
    return (
      <CreatableSelect value={form.workPermitType || null} onChange={(v: string) => setF('workPermitType', v)} allowCreate={false}
        placeholder={t('common:select')} style={inputStyle}
        options={workPermitTypes.map(w => ({ value: w.value, label: w.label }))} />
    )
  }

  const renderValue = (key: WPKey) => {
    if (key === 'workPermitValidUntil') {
      const v = currentValidUntil
      return <span style={{ fontSize: 12, color: v ? 'var(--text)' : 'var(--text-muted)' }}>{v ? formatDate(v) : '-'}</span>
    }
    // Resolve the display label from the lookup; a legacy/unknown slug (no longer
    // in the tenant's lookup) falls back to the raw stored string — never blanked.
    const label = workPermitTypes.find(w => w.value === currentType || w.label === currentType)?.label ?? currentType
    return <span style={{ fontSize: 12, color: currentType ? 'var(--text)' : 'var(--text-muted)' }}>{label || '-'}</span>
  }

  const field = (key: WPKey, label: string) => (
    <FieldRow key={key} label={label}>
      {editing ? renderInput(key) : renderValue(key)}
    </FieldRow>
  )

  // KAND-WERKVERGUNNING-2: these three keys now exist in all five locales
  // (candidates.json — nl/en/de/fr/es); `defaultValue` is kept as a harmless
  // safety net (mirrors BackgroundTab.tsx's identical KAND-REFERENTIES-1 pattern).
  return (
    <div>
      <GroupHeader title={t('profile.groupWorkPermit', { defaultValue: 'Werkvergunning' })}>
        <EditControls editing={editing} onSave={save} onCancel={cancel} onStart={() => setEditing(true)} />
      </GroupHeader>
      <GroupCard>
        {field('workPermitType', t('profile.workPermitType', { defaultValue: 'Type werkvergunning' }))}
        {field('workPermitValidUntil', t('profile.workPermitValidUntil', { defaultValue: 'Geldig tot' }))}
      </GroupCard>
    </div>
  )
}
