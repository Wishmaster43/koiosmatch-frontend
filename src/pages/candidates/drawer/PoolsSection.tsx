import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Sparkles } from 'lucide-react'
import { useCandidatePools } from '../hooks/useCandidatePools'
import { sectionBlock } from './constants'
import DrawerAddButton from './DrawerAddButton'
import type { Candidate } from '@/types/candidate'

/**
 * PoolsSection — the talent pools a candidate belongs to (chips), with an add
 * dropdown sourced from GET /pools. Presentational: the list fetch + optimistic
 * membership writes live in useCandidatePools (§3). `source: 'koios'` pools get a
 * subtle AI marker so manual vs AI-suggested membership stays distinguishable.
 */
export default function PoolsSection({ c }: { c: Candidate }) {
  const { t } = useTranslation('candidates')
  const { pools, allPools, has, toggle } = useCandidatePools(c)
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close the add-dropdown on an outside click.
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    // No section title (Danny addendum 4): this only renders inside the Match
    // tab's own "Talentenpools" sub-tab, whose bar already carries that label.
    <div>
      {/* "+ Toevoegen aan pool" sits OUTSIDE the card, top-right (Danny consistency-
          sweep addendum 3): header row with the reference-style button, chips card
          below — mirrors the + Match row on the Matches sub-tab. The search dropdown
          still anchors to this trigger (right-aligned so it stays inside the drawer). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
        <div ref={ref} style={{ position: 'relative' }}>
          <DrawerAddButton onClick={() => setOpen(o => !o)} label={t('sections.poolAdd')} />
          {open && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, marginTop: 4, minWidth: 280, maxWidth: 'min(420px, 90vw)',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common:search')} autoFocus
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', background: 'none' }} />
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {allPools.length === 0 && (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('sections.poolsEmpty')}</div>
                )}
                {allPools
                  .filter(p => (p.name ?? '').toLowerCase().includes(search.toLowerCase()))
                  .map((p, i) => {
                    const id = p.id ?? p.name
                    const selected = has(id)
                    // Fallback swatch colour, consumed below via hex+alpha string
                    // concatenation (soft-chip convention) — cannot become a CSS
                    // var without restructuring that string-based alpha suffix.
                    // eslint-disable-next-line no-restricted-syntax -- fallback swatch hex, consumed as hex+alpha string concat below
                    const color = p.color || '#6B7280'
                    return (
                      <button key={p.id ?? p.name ?? i} onClick={() => toggle(p)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '9px 12px', fontSize: 12, background: selected ? 'var(--color-primary-bg)' : 'none',
                          border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {p.name}
                        </span>
                        {selected && <Check size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                      </button>
                    )
                  })
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Membership chips card — empty state so the card never renders blank (§3). */}
      <div style={sectionBlock}>
        {pools.length === 0
          ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common:empty')}</span>
          : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {pools.map((p, i) => {
                // Fallback swatch colour, consumed below via hex+alpha string
                // concatenation (soft-chip convention) — cannot become a CSS
                // var without restructuring that string-based alpha suffix.
                // eslint-disable-next-line no-restricted-syntax -- fallback swatch hex, consumed as hex+alpha string concat below
                const color = p.color || '#6B7280'
                const ai = p.source === 'koios'
                return (
                  <span key={p.id ?? p.name ?? i} title={ai ? t('sections.poolKoios') : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '3px 8px',
                      borderRadius: 99, border: `1px solid ${color}55`, background: color + '1A', color }}>
                    {ai && <Sparkles size={10} />}
                    {p.name}
                    <button onClick={() => toggle(p)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color, opacity: 0.7, padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                  </span>
                )
              })}
            </div>
          )}
      </div>
    </div>
  )
}
