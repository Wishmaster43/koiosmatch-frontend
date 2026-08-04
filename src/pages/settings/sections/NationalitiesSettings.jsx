import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { useCountriesLookup } from '@/lib/useCountriesLookup'
import { getFlagEmoji } from '@/lib/countries'

/**
 * NationalitiesSettings — the candidate nationality lookup (LOOKUP-GAP-1, backend
 * NationalityController extends SimpleLookupController: plain name+colour CRUD, no
 * sort_order/reorder route, delete guarded 409 by candidates.nationality). Consumed
 * by useNationalities → ProfilePersonalTab. Thin wrapper mirrors RejectionSettings —
 * the same SimpleLookupController shape (no reorder endpoint on the backend).
 *
 * NATION-FLAG-1 (backend landed 04-08 — create_nationalities_table.php's
 * `country_code` column + NationalityController::validatePayload): an optional
 * ISO-2 country_code now rides the create/edit payload, picked from the platform's
 * own /countries whitelist (useCountriesLookup — never a second hand-maintained
 * country list) via the generic extraField combobox. The row's adornment is the
 * flag EMOJI derived from that code (getFlagEmoji — a real Unicode glyph, no image
 * asset), not a colour: colour stays off (§4, Danny 05-08 "alles 1 kleur?" — a
 * nationality's colour carried no meaning; the flag is the real one). extraField.
 * hideRowBadge suppresses the generic text badge StatusListEditor would otherwise
 * also render for it, so the flag is the ONE adornment, not flag + a redundant
 * "Nederland" chip.
 */
export default function NationalitiesSettings() {
  const { t } = useTranslation('settings')
  const { options: countryOptions } = useCountriesLookup()
  return (
    <div style={{ maxWidth: 640 }}>
      {/* reorderable off: SimpleLookupController family has no /reorder route (audit 04-08). */}
      <StatusListEditor reorderable={false} withColor={false} title={t('nationalities.title')} subtitle={t('nationalities.subtitle')}
        endpoint="/nationalities" addLabel={t('nationalities.add')}
        extraField={{ key: 'country_code', label: t('nationalities.countryCode'), options: countryOptions, default: null, hideRowBadge: true }}
        rowPrefix={(item) => item.country_code ? (
          <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>{getFlagEmoji(item.country_code)}</span>
        ) : null} />
    </div>
  )
}
