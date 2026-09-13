/**
 * LocationFormModal — the "+ Vestiging" / edit-branch dialog: the shared
 * FloatingPanel shell (wide-form frame, draggable header, SE-resize, remembered
 * position) around the four titled cards (Algemeen incl. branding, Adres,
 * Zakelijk, Contact) plus its Cancel/Save footer.
 *
 * The form VALUE stays in LocationsSettings (it owns the create/update payload);
 * this component only renders it and reports edits back through `setForm`, so the
 * container keeps one source of truth.
 *
 * SETTINGS-INCON-B2 (Danny 13-09, verbatim on #settings/company/locations:
 * "Pop-up is niet de standaard!! Ik kan niet slepen/verplaatsen groter of
 * kleiner maken"): this was a hand-rolled `position:fixed` dialog with no
 * drag/resize — migrated onto the shared FloatingPanel (§4 HUISSTIJL-1), the
 * ONE popup shell every dialog in the app shares. The focus trap, Escape-to-
 * close and focus-restore now live inside FloatingPanel itself (mirrors every
 * other migrated modal — NewUserModal/EditUserModal/AddCandidateModal), so this
 * file no longer arms its own useFocusTrap.
 */
import { useTranslation } from 'react-i18next'
import { WIDE_MODAL_PANEL_SIZE } from '@/components/ui/wideModalPanelSize'
import { cardHead, cardBox } from '@/components/ui/modalCards'
import { LOCATION_ICON_NAMES, resolveLocationIcon, DEFAULT_LOCATION_COLOR } from '@/lib/locationIcons'
import { ColorSwatch } from '../../components/SettingsControls'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { useCountriesLookup } from '@/lib/useCountriesLookup'
import { useProvinces } from '@/hooks/useProvinces'
import FieldNotice from '@/components/ui/FieldNotice'
import Toggle from '@/components/ui/Toggle'
import { BodyText, Caption } from '@/components/ui/typography'
import { useIdentifierValidation } from '@/hooks/useIdentifierValidation'
import IconPickerControl from '../IconPickerControl'
import FloatingPanel from '@/components/ui/FloatingPanel'
import ModalFooter from '@/components/ui/ModalFooter'

// House field footprint (Danny 27-07 point D): 11px uppercase muted label above
// each input, fontSize 13 / borderRadius 8 — mirrors match/styles.ts'
// `lbl`/`input` exactly.
const lbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5 }
const inp = { width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }

// The location create/edit modal, on the shared FloatingPanel shell.
export default function LocationFormModal({ editingId, form, setForm, saving, onClose, onSubmit }) {
  const { t } = useTranslation(['settings', 'common'])

  const setF = (k) => (e) => setForm(x => ({ ...x, [k]: e.target.value }))
  // Called as a function (not <F/>) so inputs keep focus while typing.
  // ALWAYS-SEARCHABLE (CLAUDE.md §4, Danny 08-08): country and province are
  // lookup-driven searchable pickers here too — country feeds the province
  // cascade, exactly like the candidate/vacancy address blocks.
  const { options: countryOptions } = useCountriesLookup()
  const { provinces } = useProvinces(form.country || 'NL')
  const provinceOptions = (provinces ?? []).map(p => (typeof p === 'string' ? { value: p, label: p } : p))

  const picker = (k, label, options, flex = 1) => (
    <div style={{ flex, minWidth: 0 }}>
      <div style={lbl}>{label}</div>
      <CreatableSelect value={form[k] || null} onChange={v => setF(k)({ target: { value: v } })}
        options={options} allowCreate={false} clearable placeholder={label}
        style={{ padding: '8px 11px', borderRadius: 8, fontSize: 13 }} />
    </div>
  )

  const field = (k, label, placeholder, type = 'text', flex = 1, notice = null) => (
    <div style={{ flex, minWidth: 0 }}>
      <div style={lbl}>{label}</div>
      <input type={type} value={form[k]} onChange={setF(k)} placeholder={placeholder} aria-label={label}
        style={notice?.severity === 'error' ? { ...inp, borderColor: 'var(--color-danger)' } : inp} />
      <FieldNotice text={notice?.message} severity={notice?.severity} />
    </div>
  )

  // KVK/BTW-PER-LAND-1 (Danny 08-08, points 10 + 11): our OWN establishments carry a
  // KvK/BTW too, so they get the same per-country check as a customer location — the
  // country picked right above decides the rule, the tenant setting decides warn-vs-block.
  const identifiers = useIdentifierValidation()
  const cocNotice = identifiers.notice('coc', form.coc_number, form.country)
  const vatNotice = identifiers.notice('vat', form.vat_number, form.country)
  const identifierBlocked = cocNotice?.severity === 'error' || vatNotice?.severity === 'error'

  return (
    // POPUP-SLEEP-1 / SETTINGS-INCON-B2: the shared draggable/resizable shell —
    // same wide-form footprint as AddCandidateModal/MatchModal (Danny 27-07:
    // "+ vestiging... moet net zo breed en hoog worden als + match of + nieuwe
    // kandidaat"), now also draggable and resizable like every other popup.
    <FloatingPanel open onClose={onClose}
      title={editingId ? t('locations.editTitle') : t('locations.create')}
      persistKey="location-form" resizable scrollBody={false}
      {...WIDE_MODAL_PANEL_SIZE}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Algemeen — name, branding, and default flag (B-43).
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
              {/* B-43: is_default flag — the backend keeps exactly one default location. */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle checked={!!form.is_default} onChange={v => setForm(x => ({ ...x, is_default: v }))} ariaLabel={t('locations.isDefault')} />
                  <div>
                    <BodyText>{t('locations.isDefault')}</BodyText>
                    <Caption>{t('locations.isDefaultHint')}</Caption>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Structured address — separate fields so they can be matched/validated. */}
          <div>
            <div style={cardHead}>{t('locations.sectionAddress')}</div>
            <div style={cardBox}>
              {/* Street + number + suffix on one line (compact). PLACEHOLDER-LOKAAL (X-I18N-4): the
                  postcode and phone examples come from common:placeholders per language, never a Dutch literal. */}
              <div style={{ display: 'flex', gap: 12 }}>
                {field('street', t('locations.street'), t('locations.street'), 'text', 3)}
                {field('house_number', t('locations.houseNumber'), '28', 'text', 1)}
                {field('house_number_suffix', t('locations.houseNumberSuffix'), 'A', 'text', 1)}
              </div>
              {/* I18N-1: optional second address line (unit/building), own column on the backend. */}
              <div style={{ display: 'flex', gap: 12 }}>
                {field('address_line_2', t('locations.addressLine2'), t('locations.addressLine2'))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {field('postal_code', t('locations.postalCode'), t('common:placeholders.postcodeExample'))}
                {field('city', t('locations.city'), t('locations.city'))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {picker('country', t('locations.country'), countryOptions)}
                {picker('province', t('locations.province'), provinceOptions)}
              </div>
            </div>
          </div>

          {/* Business identifiers for invoicing/registration. */}
          <div>
            <div style={cardHead}>{t('locations.sectionBusiness')}</div>
            <div style={cardBox}>
              <div style={{ display: 'flex', gap: 12 }}>
                {field('coc_number', t('locations.cocNumber'), '12345678', 'text', 1, cocNotice)}
                {field('vat_number', t('locations.vatNumber'), 'NL000000000B01', 'text', 1, vatNotice)}
              </div>
            </div>
          </div>

          {/* Contact details for this location. */}
          <div>
            <div style={cardHead}>{t('locations.sectionContact')}</div>
            <div style={cardBox}>
              {field('contact_name', t('locations.contactName'), t('locations.contactName'))}
              <div style={{ display: 'flex', gap: 12 }}>
                {field('phone', t('locations.phone'), t('common:placeholders.phoneExample'), 'tel')}
                {field('email', t('locations.email'), 'name@company.com', 'email')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KVK/BTW-PER-LAND-1: only a BLOCKING mismatch gates Save — a warning still saves. */}
      <ModalFooter onCancel={onClose} onSubmit={onSubmit}
        disabled={saving || !form.name.trim() || identifierBlocked} busy={saving}
        cancelLabel={t('common.cancel')} submitLabel={editingId ? t('common.save') : t('locations.createBtn')} />
    </FloatingPanel>
  )
}
