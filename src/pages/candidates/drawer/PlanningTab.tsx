import { useState, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Check, Info } from 'lucide-react'
import { sectionBlock, sectionTitle } from './constants'
import { useFunctions } from '@/lib/useFunctions'
import { usePools } from '@/lib/usePools'
import { useDriverLicenses } from '@/lib/useDriverLicenses'
import type { Candidate } from '@/types/candidate'

// AXIS-MATRIX-2 audit R1 (CMFE 2026-07-17): this tab's fields never had a save
// path — no PATCH/PUT endpoint writes `candidate_planning_settings` anywhere in
// the backend (only a read-side resource exists), so every toggle below used to
// silently discard the recruiter's edit on close. Per the audit's explicit
// instruction, this does NOT invent an endpoint — it gates the whole tab
// read-only (disabled fields + one calm notice) until the planning module ships
// a real write path, so the UI stops lying about what it persists.
const disabledStyle: CSSProperties = { cursor: 'not-allowed', opacity: 0.55 }

// One selectable chip — `disabled` (the not-yet-persisted gate) both disables the
// native button (keyboard/focus semantics for free) and dims it, while still
// showing which values are selected (layout stays, per the audit instruction).
const Chip = ({ label, selected, onToggle, disabled }: { label: ReactNode; selected: boolean; onToggle: () => void; disabled?: boolean }) => (
  <button onClick={onToggle} disabled={disabled} style={{
    padding: '4px 11px', fontSize: 11, borderRadius: 99, transition: 'all 0.1s',
    border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}`,
    background: selected ? 'var(--color-primary)' : 'var(--bg)',
    color: selected ? '#fff' : 'var(--text-muted)', fontWeight: selected ? 600 : 400,
    ...(disabled ? disabledStyle : { cursor: 'pointer' }),
  }}>
    {label}
  </button>
)

const SecLabel = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</span>
    {action}
  </div>
)

/** Roles, pools, shift-type and driving-licence settings used by the planner (read-only preview — see file header). */
export default function PlanningTab({ c }: { c: Candidate }) {
  // Vocabularies from the tenant lookups (no hardcoded role/pool/licence lists).
  const { functions: ALL_FUNCTIONS } = useFunctions() as { functions: string[] }
  const { pools: ALL_POOLS } = usePools()
  const { licenses: DRIVING_LICENCES } = useDriverLicenses() as { licenses: string[] }
  const plan = c.planningSettings ?? {}
  // Kept as local state purely to render whatever the candidate already carries —
  // none of the setters below are wired to a save call (see file header).
  const [info] = useState<string>((plan.info as string) ?? '')
  const [roles] = useState<string[]>((plan.roles as string[]) ?? [])
  const [pools] = useState<string[]>((plan.pools as string[]) ?? [])
  const [shiftType] = useState<string[]>((plan.shiftType as string[]) ?? [])
  const [drivingLicences] = useState<string[]>((plan.drivingLicences as string[]) ?? [])
  const [rowOpen, setRowOpen] = useState(false)
  const rijRef = useRef<HTMLDivElement>(null)

  // Close the licence dropdown on an outside click (dead code today since the
  // trigger below is disabled and never opens it — kept so it re-activates for
  // free the moment a real save path lands and the gate above is lifted).
  useEffect(() => {
    const h = (e: MouseEvent) => { if (rijRef.current && !rijRef.current.contains(e.target as Node)) setRowOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const { t } = useTranslation('candidates')

  const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }
  const shiftTypeOpts: [string, string][] = [['Avonddienst', 'eveningShift'], ['Dagdienst', 'dayShift'], ['Nachtdienst', 'nightShift']]
  return (
    <div style={sectionBlock}>
      <span style={sectionTitle}>{t('planning.rolesPoolsSkills')}</span>

      {/* Calm, explicit notice — the whole tab below is a read-only preview until a real PATCH exists. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 14, padding: '8px 10px',
        borderRadius: 8, background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)' }}>
        <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('planning.notPersistedYet')}</span>
      </div>

      {/* Info */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel>{t('planning.planningInfo')}</SecLabel>
        <input value={info} disabled placeholder={t('planning.planningNote')} style={{ ...inputStyle, ...disabledStyle }} aria-label={t('planning.planningInfo')} />
      </div>

      {/* Roles */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel action={
          <button disabled
            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, ...disabledStyle }}>
            {roles.length === ALL_FUNCTIONS.length ? t('common:none') : t('common:all')}
          </button>
        }>{t('planning.globalFunction')}</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_FUNCTIONS.map((f: string) => <Chip key={f} label={f} selected={roles.includes(f)} onToggle={() => {}} disabled />)}
        </div>
      </div>

      {/* Pools */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel action={
          <button disabled
            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0, ...disabledStyle }}>
            {pools.length === ALL_POOLS.length ? t('common:none') : t('common:all')}
          </button>
        }>{t('planning.pools')}</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_POOLS.map((p: string) => <Chip key={p} label={p} selected={pools.includes(p)} onToggle={() => {}} disabled />)}
        </div>
      </div>

      {/* Shift type */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel>{t('planning.shiftPref')}</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {shiftTypeOpts.map(([d, k]) => (
            <Chip key={d} label={t(`planning.${k}`)} selected={shiftType.includes(d)} onToggle={() => {}} disabled />
          ))}
        </div>
      </div>

      {/* Driving licences */}
      <div>
        <SecLabel>{t('planning.licenses')}</SecLabel>
        {drivingLicences.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {drivingLicences.map(r => (
              <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11,
                borderRadius: 99, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, opacity: 0.7 }}>
                {r}
                <button disabled aria-label={t('common:close')}
                  style={{ background: 'none', border: 'none', color: '#fff', padding: 0, lineHeight: 1, fontSize: 14, ...disabledStyle, opacity: 0.7 }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div ref={rijRef} style={{ position: 'relative' }}>
          <button disabled
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, fontWeight: 500,
              border: '1px dashed var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', ...disabledStyle }}>
            <Plus size={11} /> {t('planning.addLicense')}
          </button>
          {rowOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 180 }}>
              {DRIVING_LICENCES.map((r: string) => {
                const sel = drivingLicences.includes(r)
                return (
                  <button key={r} disabled
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
                      background: sel ? 'var(--color-primary-bg)' : 'none', border: 'none', textAlign: 'left', ...disabledStyle }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                      border: `2px solid ${sel ? 'var(--color-primary)' : 'var(--border)'}`,
                      background: sel ? 'var(--color-primary)' : 'var(--surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {sel && <Check size={9} color="white" />}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{r}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
