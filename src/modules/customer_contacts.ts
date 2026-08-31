// customer_contacts module — vertrekmodule (ENTITY-MODULES-ONTBREKEND-1, Danny's §10
// subjectlijst; CMBE-vocab definitief 31-08). Fetch-only: the engine's thin
// module carries Ophalen only, so no create/update actions here (§3 — no fake
// affordances). Bundle carries naam/functie/email/phone/mobile; encrypted dossiertekst stays OUT (CMBE contract).
import { Contact } from 'lucide-react'
import { tint } from '@/lib/tint'
import makeEntityModule from './_entityModule'

export default makeEntityModule({
  type:     'customer_contacts',
  label:    'Contactpersonen',
  category: 'Klanten',
  Icon:     Contact,
  color:    'var(--module-mauve)',
  bg:       tint('var(--module-mauve)', 16),
  actions:  ['Ophalen'],
  filterFields: [
    { value: 'customer', label: 'Klant' },
    { value: 'location', label: 'Vestiging' },
    { value: 'department', label: 'Afdeling' },
    { value: 'function', label: 'Functie' },
    { value: 'is_primary', label: 'Primair contact' },
  ],
  sortOptions: [
    { value: 'last_name', label: 'Achternaam' },
    { value: 'created_at', label: 'Aangemaakt' },
  ],
})
