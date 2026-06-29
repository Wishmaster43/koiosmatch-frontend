import { useState, useEffect, useRef } from 'react'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Check } from 'lucide-react'
import { sectionBlock, sectionTitle } from './constants'
import { useFunctions } from '@/lib/useFunctions'
import { usePools } from '@/lib/usePools'
import { useDriverLicenses } from '@/lib/useDriverLicenses'
import type { Candidate } from '@/types/candidate'

const Chip = ({ label, selected, onToggle }: { label: ReactNode; selected: boolean; onToggle: () => void }) => (
  <button onClick={onToggle} style={{
    padding: '4px 11px', fontSize: 11, borderRadius: 99, cursor: 'pointer', transition: 'all 0.1s',
    border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border)'}`,
    background: selected ? 'var(--color-primary)' : 'var(--bg)',
    color: selected ? '#fff' : 'var(--text-muted)', fontWeight: selected ? 600 : 400,
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

/** Roles, pools, shift-type and driving-licence settings used by the planner. */
export default function PlanningTab({ c }: { c: Candidate }) {
  // Vocabularies from the tenant lookups (no hardcoded role/pool/licence lists).
  const { functions: ALL_FUNCTIONS } = useFunctions() as { functions: string[] }
  const { pools: ALL_POOLS } = usePools()
  const { licenses: DRIVING_LICENCES } = useDriverLicenses() as { licenses: string[] }
  const plan = c.planningSettings ?? {}
  const [info,         setInfo]        = useState<string>((plan.info as string) ?? '')
  const [roles,     setRoles]    = useState<string[]>((plan.roles as string[]) ?? [])
  const [pools,        setPools]       = useState<string[]>((plan.pools as string[]) ?? [])
  const [shiftType,   setShiftType]  = useState<string[]>((plan.shiftType as string[]) ?? [])
  const [drivingLicences,  setDrivingLicences] = useState<string[]>((plan.drivingLicences as string[]) ?? [])
  const [rowOpen,      setRowOpen]     = useState(false)
  const rijRef = useRef<HTMLDivElement>(null)

  // Close the licence dropdown on an outside click.
  useEffect(() => {
    const h = (e: MouseEvent) => { if (rijRef.current && !rijRef.current.contains(e.target as Node)) setRowOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  // Toggle one value in a string-list selection.
  const tog = (val: string, set: Dispatch<SetStateAction<string[]>>) => set(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  const { t } = useTranslation('candidates')

  const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }
  const shiftTypeOpts: [string, string][] = [['Avonddienst', 'eveningShift'], ['Dagdienst', 'dayShift'], ['Nachtdienst', 'nightShift']]
  return (
    <div style={sectionBlock}>
      <span style={sectionTitle}>{t('planning.rolesPoolsSkills')}</span>

      {/* Info */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel>{t('planning.planningInfo')}</SecLabel>
        <input value={info} onChange={e => setInfo(e.target.value)} placeholder={t('planning.planningNote')} style={inputStyle} />
      </div>

      {/* Roles */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel action={
          <button onClick={() => setRoles(f => f.length === ALL_FUNCTIONS.length ? [] : [...ALL_FUNCTIONS])}
            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {roles.length === ALL_FUNCTIONS.length ? t('common:none') : t('common:all')}
          </button>
        }>{t('planning.globalFunction')}</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_FUNCTIONS.map((f: string) => <Chip key={f} label={f} selected={roles.includes(f)} onToggle={() => tog(f, setRoles)} />)}
        </div>
      </div>

      {/* Pools */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel action={
          <button onClick={() => setPools(p => p.length === ALL_POOLS.length ? [] : [...ALL_POOLS])}
            style={{ fontSize: 11, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {pools.length === ALL_POOLS.length ? t('common:none') : t('common:all')}
          </button>
        }>{t('planning.pools')}</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_POOLS.map((p: string) => <Chip key={p} label={p} selected={pools.includes(p)} onToggle={() => tog(p, setPools)} />)}
        </div>
      </div>

      {/* Shift type */}
      <div style={{ marginBottom: 16 }}>
        <SecLabel>{t('planning.shiftPref')}</SecLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {shiftTypeOpts.map(([d, k]) => (
            <Chip key={d} label={t(`planning.${k}`)} selected={shiftType.includes(d)} onToggle={() => tog(d, setShiftType)} />
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
                borderRadius: 99, border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600 }}>
                {r}
                <button onClick={() => setDrivingLicences(p => p.filter(x => x !== r))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, lineHeight: 1, fontSize: 14, opacity: 0.7 }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div ref={rijRef} style={{ position: 'relative' }}>
          <button onClick={() => setRowOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 11, fontWeight: 500,
              border: '1px dashed var(--border)', borderRadius: 7, background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Plus size={11} /> {t('planning.addLicense')}
          </button>
          {rowOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 180 }}>
              {DRIVING_LICENCES.map((r: string) => {
                const sel = drivingLicences.includes(r)
                return (
                  <button key={r} onClick={() => tog(r, setDrivingLicences)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
                      background: sel ? 'var(--color-primary-bg)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
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
