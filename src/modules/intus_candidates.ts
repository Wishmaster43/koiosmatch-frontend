// intus_candidates module — HTTP call to the Intus API for candidates.
// Uses the shared Intus module factory; differs only in type and label.
import { makeIntusModule } from './intusFactory'

export default makeIntusModule('intus_candidates', 'Kandidaten', 'color-mix(in srgb, var(--module-intus) 9%, transparent)', 'https://api.intus.example/candidates')
