/**
 * ContactFunctionsSettings — the contact-person job-title list (/contact-functions,
 * FUNCTIONS-SPLIT-1) + the free-entry toggle (Danny 24-07: "ook voor deze het blok
 * vrije invoer toestaan" — allow free entry for this block too). A thin config
 * over the shared FreeEntryLookupSettings (see its own doc comment for the
 * dedicated-route reasoning), plus a `notFoundNotice` for tenants where this
 * lookup is not deployed yet.
 *
 * FUNC-FREEENTRY-FIX (2026-08-17): persists through the REAL dedicated
 * `PUT /contact-functions/free-entry` route — never the generic `/settings` blob.
 * That blob used to write an UNDERSCORED key (`contact_functions_allow_free_entry`)
 * that neither `CustomerContactController`'s write-time gate on
 * `customer_contacts.function` nor `FreeEntryLookupController::allowFreeEntry()`
 * (this list's own GET) ever reads — both read the DOTTED
 * `contact_functions.allow_free_entry` Setting row, moved only by this dedicated
 * route. See useContactFunctions.ts's own doc comment for the full trail; mirrors
 * ApplicationSourcesSettings.jsx / FunctionsSettings.jsx exactly.
 */
import { useTranslation } from 'react-i18next'
import { useContactFunctions } from '@/lib/useContactFunctions'
import FreeEntryLookupSettings from '../components/FreeEntryLookupSettings'

export default function ContactFunctionsSettings() {
  const { t } = useTranslation('settings')
  return (
    <FreeEntryLookupSettings
      useLookup={useContactFunctions}
      endpoint="/contact-functions"
      i18nPrefix="contactFunctionsSettings"
      statusListEditorProps={{ notFoundNotice: t('contactFunctionsSettings.notAvailable') }}
    />
  )
}
