/**
 * ContactLinkPicker — the "Koppelen" picker for LocationContacts: pick an existing
 * customer contact to link to THIS location. Widened (Danny 28-07: "de popup moet
 * groter en breeder") from a narrow 380px name list to the app's shared wide-modal
 * footprint, with a search box and, per contact, the locations/departments they are
 * ALREADY linked to — so the user can see what they are re-pointing before picking.
 */
import { useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Search } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import SoftChipJs from '@/components/ui/SoftChip'
import type { Contact, Department } from '@/types/customer'
import type { Id } from '@/types/common'

// SoftChip is a .jsx component — cast at the boundary (mirrors ContactsTab.tsx).
type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>

// Mirrors SubEntityTab's search box styling so every drawer search box looks identical.
const searchWrap: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }
const searchInput: CSSProperties = { flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)' }
const rowBtn: CSSProperties = { display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '11px 16px', fontSize: 12, textAlign: 'left', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)' }

interface Props {
  // The customer's contacts NOT already at this location.
  candidates: Contact[]
  // The customer's locations, for resolving the singular locationId fallback.
  locations: { id: Id; name: string }[]
  // The customer's departments, for resolving the singular departmentId fallback.
  departments: Department[]
  onPick: (id: Id) => void
  onClose: () => void
}

export default function ContactLinkPicker({ candidates, locations, departments, onPick, onClose }: Props) {
  const { t } = useTranslation('customers')
  const [search, setSearch] = useState('')
  // Focus trap + Escape-to-close + focus restore (§6) — the previous inline
  // version had none of this, a real accessibility gap.
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)

  // Fallback resolver — copied verbatim from ContactsTab.tsx (never a second
  // resolver): the plural locations[]/departments[] arrays come back EMPTY for
  // every seeded contact today (measured 2026-07-14), so the PRIMARY singular
  // id is resolved against the customer-wide lists this component already has.
  const resolvedLocations = (c: Contact) => c.locations.length > 0 ? c.locations
    : (c.locationId != null ? locations.filter(l => String(l.id) === String(c.locationId)) : [])
  const resolvedDepartments = (c: Contact): { id: Id; name: string }[] => c.departments.length > 0 ? c.departments
    : (c.departmentId != null ? departments.filter(d => String(d.id) === String(c.departmentId)).map(d => ({ id: d.id as Id, name: d.name })) : [])

  // Client-side search over name/role/email.
  const q = search.trim().toLowerCase()
  const rows = q ? candidates.filter(c => [c.name, c.role, c.email].some(v => String(v ?? '').toLowerCase().includes(q))) : candidates

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('locations.detail.pickContactTitle')} tabIndex={-1}
        style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', ...WIDE_MODAL, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('locations.detail.pickContactTitle')}</span>
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
        </div>

        {/* Search stays fixed above the scrolling list, mirrors SubEntityTab. */}
        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <div style={searchWrap}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('locations.detail.pickContactSearch')} aria-label={t('locations.detail.pickContactSearch')} style={searchInput} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
          {candidates.length === 0 && <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('locations.detail.pickContactEmpty')}</div>}
          {candidates.length > 0 && rows.length === 0 && <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{t('common:noResults')}</div>}
          {rows.map(c => {
            // Per-contact CURRENT links — so the user sees what they're re-pointing.
            const linkedLocations = resolvedLocations(c)
            const linkedDepartments = resolvedDepartments(c)
            const hasLinks = linkedLocations.length > 0 || linkedDepartments.length > 0
            return (
              <button key={String(c.id)} onClick={() => onPick(c.id as Id)} style={rowBtn}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--text)' }}>{c.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>{[c.role, c.email].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ flexShrink: 0, maxWidth: '55%', textAlign: 'right' }}>
                  {hasLinks ? (
                    <>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{t('locations.detail.pickContactLinks')}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                        {linkedLocations.map(l => <SoftChip key={`loc-${String(l.id)}`} label={l.name} color="var(--color-secondary)" />)}
                        {linkedDepartments.map(d => <SoftChip key={`dep-${String(d.id)}`} label={d.name} color="var(--color-violet)" />)}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('locations.detail.pickContactNoLinks')}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
