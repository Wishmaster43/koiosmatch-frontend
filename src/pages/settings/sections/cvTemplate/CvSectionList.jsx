/**
 * CvSectionList — the "sections" card of the CV template settings screen: the
 * region-grouped list of CV sections with their on/off toggle, sidebar⇄main
 * region picker and up/down reorder. It owns BOTH the list markup AND the three
 * section mutations, because those handlers exist only to serve these controls —
 * keeping them together means the settings screen just hands over the sections
 * and a save fn instead of threading three callbacks through.
 */
import { useTranslation } from 'react-i18next'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { CV_MOVABLE_SECTION_IDS } from '@/lib/useCvSettings'
import { Toggle } from '@/pages/settings/components/SettingsKit'
import SegmentedControl from '@/components/ui/SegmentedControl'

// `sections` is the normalized list from useCvSettings; `onSave` its partial-save fn.
export default function CvSectionList({ sections, onSave }) {
  const { t } = useTranslation('settings')
  const { t: tCv } = useTranslation('candidates')

  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 5, display: 'block' }

  // Flip one section's on/off flag and persist the whole (partial-saved) list.
  const handleSectionToggle = (id) => {
    onSave({ sections: sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s) })
  }

  // Sidebar and main column reorder independently (they render as two separate
  // lists, §CV placement) — so "up"/"down" only swaps within sections sharing
  // the same resolved placement, never jumping a section into the other region.
  const handleSectionMove = (id, dir) => {
    const arr = [...sections]
    const target = arr.find(s => s.id === id)
    if (!target) return
    const groupIdx = arr.reduce((acc, s, i) => (s.placement === target.placement ? [...acc, i] : acc), [])
    const posInGroup = groupIdx.indexOf(arr.indexOf(target))
    const swapPos = posInGroup + dir
    if (swapPos < 0 || swapPos >= groupIdx.length) return
    const i1 = groupIdx[posInGroup]
    const i2 = groupIdx[swapPos]
    ;[arr[i1], arr[i2]] = [arr[i2], arr[i1]]
    onSave({ sections: arr })
  }

  // Move a MOVABLE section to the other CV region (sidebar ⇄ main column,
  // Danny 28-07, translated: "I also want to be able to determine the location
  // of each section" — verbatim: "ik wil ook de locatie van elke sectie kunnen
  // bepalen"); it
  // lands wherever its stored index puts it in the new region, adjustable
  // afterwards with the up/down arrows.
  const handleSectionPlacement = (id, placement) => {
    onSave({ sections: sections.map(s => (s.id === id ? { ...s, placement } : s)) })
  }

  return (
    /* Sections — grouped by region (header/sidebar/main column) so the
       list visually mirrors the CV layout itself (§ CV placement). */
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', background: 'var(--surface)' }}>
      <label style={labelStyle}>{t('cvTemplate.sections')}</label>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>{t('cvTemplate.sectionsHint')}</p>
      {[
        { region: 'header',  items: sections.filter(s => s.placement === 'header') },
        { region: 'sidebar', items: sections.filter(s => s.placement === 'sidebar') },
        { region: 'main',    items: sections.filter(s => s.placement === 'main') },
      ].map(({ region, items }) => items.length > 0 && (
        <div key={region} data-testid={`cv-section-group-${region}`} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            {t(`cvTemplate.region${region === 'sidebar' ? 'Sidebar' : region === 'main' ? 'Main' : 'Header'}`)}
          </div>
          {items.map((sec, idx, arr) => {
            // The section's display name is ALWAYS resolved by id through i18n
            // (never the raw stored `label`) — a tenant may still have a blob
            // saved with the old hardcoded English label; that string is only
            // ever used as the i18next defaultValue fallback, never displayed
            // directly (§5 i18n fix, "profile text" → "Profieltekst").
            const label = tCv(`cv.${sec.id}`, { defaultValue: sec.label })
            const movable = CV_MOVABLE_SECTION_IDS.includes(sec.id)
            return (
              <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
                borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {/* Shared house Toggle (Danny 28-07, translated: "NO CHECKBOXES BUT
                    TOGGLES!!!" — verbatim: "GEEN VINKJES MAAR TOGGLES!!!") — replaces the
                    hand-rolled ToggleLeft/ToggleRight icon button so every on/off control looks the same. */}
                <Toggle checked={sec.enabled} ariaLabel={label} onChange={() => handleSectionToggle(sec.id)} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 12, color: sec.enabled ? 'var(--text)' : 'var(--text-muted)', fontWeight: sec.enabled ? 500 : 400 }}>
                  {label}
                </span>
                {movable ? (
                  // Shared SegmentedControl (audit finding 05-08, compact size — the
                  // spot is a single row, not the default vertical option-card layout)
                  // replaces the hand-rolled two-button RegionToggle fork. The
                  // radiogroup's own accessible name is the section's label (e.g.
                  // "Talen") — each option's name comes from its own visible text
                  // ("Zijbalk"/"Hoofdkolom"), so no separate i18n key is needed.
                  <SegmentedControl size="compact" ariaLabel={label} value={sec.placement}
                    onChange={p => handleSectionPlacement(sec.id, p)}
                    options={[
                      { value: 'sidebar', label: t('cvTemplate.regionSidebar') },
                      { value: 'main', label: t('cvTemplate.regionMain') },
                    ]} />
                ) : (
                  // Structural placement (§ CV_FIXED_PLACEMENT): no picker offered —
                  // moving it would either not exist as a region (header) or break
                  // the layout (a long list squeezed into the narrow sidebar).
                  <span title={t(sec.placement === 'header' ? 'cvTemplate.regionHeaderHint' : 'cvTemplate.regionFixedMainHint')}
                    style={{ fontSize: 10, color: 'var(--text-muted)', padding: '3px 8px' }}>
                    {t(`cvTemplate.region${sec.placement === 'header' ? 'Header' : 'Main'}`)}
                  </span>
                )}
                {region === 'header' ? (
                  <div style={{ width: 44 }} />
                ) : (
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button onClick={() => handleSectionMove(sec.id, -1)} disabled={idx === 0}
                      aria-label={t('cvTemplate.moveSectionUp', { section: label })}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        padding: '2px 5px', color: idx === 0 ? 'color-mix(in srgb, var(--text-muted) 55%, transparent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      <ChevronUp size={11} />
                    </button>
                    <button onClick={() => handleSectionMove(sec.id, 1)} disabled={idx === arr.length - 1}
                      aria-label={t('cvTemplate.moveSectionDown', { section: label })}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: idx === arr.length - 1 ? 'not-allowed' : 'pointer',
                        padding: '2px 5px', color: idx === arr.length - 1 ? 'color-mix(in srgb, var(--text-muted) 55%, transparent)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      <ChevronDown size={11} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
