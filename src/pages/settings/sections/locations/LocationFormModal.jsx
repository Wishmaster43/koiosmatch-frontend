/**
 * LocationFormModal — the "+ Vestiging" / edit-branch dialog: overlay, wide-form
 * frame and the four titled cards (Algemeen incl. branding, Adres, Zakelijk,
 * Contact) plus its Cancel/Save footer.
 *
 * The form VALUE stays in LocationsSettings (it owns the create/update payload);
 * this component only renders it and reports edits back through `setForm`, so the
 * container keeps one source of truth. Pulled out of that container (28-07) —
 * it was more than a third of the file and has nothing to do with loading or
 * deleting locations.
 *
 * The focus trap is armed HERE, not in the always-mounted container (fixed
 * 30-07): useFocusTrap's effect attaches to `ref.current` on mount, so it needs
 * a component that only exists while the dialog is open — mirrors
 * ConfirmDialog's DialogPanel / AddLocationModal. The container previously called
 * useFocusTrap unconditionally above its `showModal &&` branch, so the ref was
 * still null the one time the effect ever ran (page mount) and never fired
 * again: no trap, no Escape-to-close, no focus restore, despite this docblock's
 * promise of all three.
 */
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import { BTN_H } from '@/config/buttonMetrics'
import { LOCATION_ICON_NAMES, resolveLocationIcon, DEFAULT_LOCATION_COLOR } from '@/lib/locationIcons'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { ColorSwatch } from '../../components/SettingsControls'
import IconPickerControl from '../IconPickerControl'

// House field footprint (Danny 27-07 point D): 11px uppercase muted label above
// each input, fontSize 13 / borderRadius 8 — mirrors match/styles.ts'
// `lbl`/`input` exactly.
const lbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5 }
const inp = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }

export default function LocationFormModal({ editingId, form, setForm, saving, onClose, onSubmit }) {
  const { t } = useTranslation(['settings', 'common'])
  // This component is only mounted while the dialog is open (the container
  // renders it behind `showModal &&`), so this effect attaches to a real node
  // every time it opens — Esc-to-close, tab-trap and focus-restore all work.
  const panelRef = useFocusTrap(onClose)

  const setF = (k) => (e) => setForm(x => ({ ...x, [k]: e.target.value }))
  // Called as a function (not <F/>) so inputs keep focus while typing.
  const field = (k, label, placeholder, type = 'text', flex = 1) => (
    <div style={{ flex, minWidth: 0 }}>
      <div style={lbl}>{label}</div>
      <input type={type} value={form[k]} onChange={setF(k)} placeholder={placeholder} aria-label={label} style={inp} />
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      {/* Wide-form frame (Danny 27-07: "+ vestiging... moet net zo breed en hoog
          worden als + match of + nieuwe kandidaat") — same WIDE_MODAL footprint
          as AddCandidateModal/MatchModal, `94vw` cap so it still breathes
          on narrow viewports (mirrors match/styles.ts' `panel`, this
          component being `position: fixed` with no flex-centering overlay of its
          own). role="dialog" + useFocusTrap (§6): focus trap, Escape-to-close,
          focus restore — this panel had none of that before. */}
      <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}
        aria-label={editingId ? t('locations.editTitle') : t('locations.create')}
        className="fixed z-50" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'var(--surface)', borderRadius: 12, padding: 24, width: '94vw', maxWidth: WIDE_MODAL.maxWidth, maxHeight: WIDE_MODAL.maxHeight, overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{editingId ? t('locations.editTitle') : t('locations.create')}</span>
          <button onClick={onClose} aria-label={t('common.cancel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Algemeen — just the name; this form carries no "standaard"/default
              flag (unlike the customer-location modal), so nothing invented here.
              Titled-card chrome (Danny 27-07 point B: "kaders om elk blokje") via
              the shared cardHead/cardBox (CLAUDE.md §11: one source instead of a
              per-entity copy). */}
          <div>
            <div style={cardHead}>{t('locations.sectionGeneral')}</div>
            <div style={cardBox}>
              {field('name', t('locations.nameLabel'), t('locations.namePlaceholder'))}
              {/* Branding (VESTIGING-ICOON-1) — the same ColorSwatch/IconPickerControl
                  every other lookup editor reuses (StatusListEditor), not a bespoke
                  picker. Both ride along in the create/update payload. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
                <div>
                  <div style={lbl}>{t('locations.color')}</div>
                  <ColorSwatch color={form.color} onChange={c => setForm(x => ({ ...x, color: c }))} />
                </div>
                <div>
                  <div style={lbl}>{t('locations.icon')}</div>
                  <IconPickerControl icons={LOCATION_ICON_NAMES} resolve={resolveLocationIcon}
                    value={form.icon} color={form.color || DEFAULT_LOCATION_COLOR}
                    label={t('locations.icon')} onPick={icon => setForm(x => ({ ...x, icon }))} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{t('locations.colorHint')}</p>
            </div>
          </div>

          {/* Structured address — separate fields so they can be matched/validated. */}
          <div>
            <div style={cardHead}>{t('locations.sectionAddress')}</div>
            <div style={cardBox}>
              {/* Street + number + suffix on one line (compact, NL convention). */}
              <div style={{ display: 'flex', gap: 12 }}>
                {field('street', t('locations.street'), t('locations.street'), 'text', 3)}
                {field('house_number', t('locations.houseNumber'), '28', 'text', 1)}
                {field('house_number_suffix', t('locations.houseNumberSuffix'), 'A', 'text', 1)}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {field('postal_code', t('locations.postalCode'), '1234 AB')}
                {field('city', t('locations.city'), t('locations.city'))}
              </div>
              {field('country', t('locations.country'), 'Nederland')}
            </div>
          </div>

          {/* Business identifiers for invoicing/registration. */}
          <div>
            <div style={cardHead}>{t('locations.sectionBusiness')}</div>
            <div style={cardBox}>
              <div style={{ display: 'flex', gap: 12 }}>
                {field('coc_number', t('locations.cocNumber'), '12345678')}
                {field('vat_number', t('locations.vatNumber'), 'NL000000000B01')}
              </div>
            </div>
          </div>

          {/* Contact details for this location. */}
          <div>
            <div style={cardHead}>{t('locations.sectionContact')}</div>
            <div style={cardBox}>
              {field('contact_name', t('locations.contactName'), t('locations.contactName'))}
              <div style={{ display: 'flex', gap: 12 }}>
                {field('phone', t('locations.phone'), '+31 6 12345678', 'tel')}
                {field('email', t('locations.email'), 'name@company.com', 'email')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ height: BTN_H, padding: '0 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>{t('common.cancel')}</button>
          <button onClick={onSubmit} disabled={saving || !form.name.trim()}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer', opacity: form.name.trim() ? 1 : 0.4 }}>
            {saving ? t('common.saving') : (editingId ? t('common.save') : t('locations.createBtn'))}
          </button>
        </div>
      </div>
    </>
  )
}
