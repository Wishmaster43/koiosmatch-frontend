import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import { useLookups } from '@/context/LookupsContext'
import type { Candidate } from '@/types/candidate'
import type { LookupOption } from '@/types/common'

/**
 * CandidateTypeSection — the multi-value contract form (on-call, ZZP, payroll,
 * temp-agency, secondment) as toggle chips. Moved out of the drawer header into
 * the Preferences tab. Options come from the tenant lookup (never hardcoded); the
 * exact selected set is persisted through `onChange`.
 */
export default function CandidateTypeSection({ c, onChange }: { c: Candidate; onChange?: (types: string[]) => void }) {
  const { t } = useTranslation('candidates')
  const { candidateTypes } = useLookups() as unknown as { candidateTypes: LookupOption[] }

  // Local optimistic set, reset when a different candidate is shown (render-time
  // pattern — React's recommended way to derive state from a changing prop).
  const [types, setTypes] = useState<string[]>(c.candidateTypes ?? [])
  const [prevId, setPrevId] = useState(c.id)
  if (c.id !== prevId) { setPrevId(c.id); setTypes(c.candidateTypes ?? []) }

  // Toggle one type and push the exact resulting set to the persist handler.
  const toggle = (v: string) => {
    const next = types.includes(v) ? types.filter(x => x !== v) : [...types, v]
    setTypes(next); onChange?.(next)
  }

  return (
    <SectionCard title={t('drawer.candidateType')}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {candidateTypes.map(ct => {
          const active = types.includes(ct.value)
          return (
            <button key={ct.value} type="button" onClick={() => toggle(ct.value)}
              style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                fontWeight: active ? 600 : 400,
                background: active ? ct.color + '1A' : 'var(--surface)',
                color: active ? ct.color : 'var(--text-muted)',
                border: `1px solid ${active ? ct.color + '55' : 'var(--border)'}`, transition: 'all 0.12s' }}>
              {ct.label}
            </button>
          )
        })}
      </div>
    </SectionCard>
  )
}
