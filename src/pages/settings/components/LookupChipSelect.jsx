/**
 * LookupChipSelect — the ONE shared block for "select which lookup values count"
 * (vacancy statuses / deployability statuses / contract forms / phases / …).
 * Renders one ROW per lookup value: the value as a soft-tinted chip in its own
 * colour + a real Toggle switch ("Toggle maken!!" — "Make it a Toggle!!", Danny
 * 2026-08-05 — the earlier
 * chip-buttons read as static pills, not as controls). Replaces the duplicated
 * raw-checkbox `LookupCheckboxBlock` that used to live inline in
 * VacancyCandidateTabSettings and CandidateVacancyTabSettings. The name stays
 * (both callers + tests import it) even though the control inside is now a toggle.
 */
import Toggle from '@/components/ui/Toggle'
import { chipInk, tintBg, tintBorder } from '@/lib/tint'

// The one shared "select which lookup values count" block (see file docblock
// above): one row per value, a real Toggle switch rather than a static-looking chip.
export default function LookupChipSelect({ label, hint, items, selected, onToggle, emptyText, ariaLabel }) {
  return (
    <div>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
          {label}
        </label>
      )}
      {hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{hint}</p>}
      {items.length === 0 && emptyText && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{emptyText}</p>
      )}
      <div role="group" aria-label={ariaLabel ?? label} style={{ display: 'flex', flexDirection: 'column', maxWidth: 420 }}>
        {items.map(it => {
          const on = selected.includes(it.value)
          const tone = it.color || 'var(--color-primary)'
          return (
            <div key={it.value} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                         gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              {/* The value reads as the soft chip it is everywhere else (§4) — colour stays
                  even when toggled off; the Toggle carries the on/off state, not the tint. */}
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                             background: tintBg(tone), color: chipInk(tone),
                             border: tintBorder(tone) }}>
                {it.label}
              </span>
              <Toggle checked={on} onChange={() => onToggle(it.value)} ariaLabel={it.label} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
