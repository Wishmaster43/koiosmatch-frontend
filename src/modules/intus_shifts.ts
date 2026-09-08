// intus_shifts module — HTTP call to the Intus API for shifts (diensten).
// Uses the shared Intus module factory; differs only in type and label.
import { makeIntusModule } from './intusFactory'

export default makeIntusModule('intus_shifts', 'Diensten', 'color-mix(in srgb, var(--module-intus) 9%, transparent)', 'https://api.intus.example/shifts')
