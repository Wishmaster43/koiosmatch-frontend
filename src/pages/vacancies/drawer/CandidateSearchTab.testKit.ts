/** CandidateSearchTab · shared seed DATA for the split test files (plain data only, no mocks or components). */
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the DEFAULT_* lookup seeds and the backend status colour, not a UI colour choice */

// Tenant status + contract-form lookup seeds ('available' is the one the hook's soft default matches).
export const lookupStatuses = [
  { value: 'available', label: 'Beschikbaar', color: '#79B58E' },
  { value: 'unavailable', label: 'Niet beschikbaar', color: '#C9AC64' },
]
export const lookupCandidateTypes = [
  { value: 'temp_agency', label: 'Uitzendkracht', color: '#DDA071' },
  { value: 'freelance', label: 'ZZP', color: '#5FB0AC' },
]

// Deliberately NOT distance-sorted: Alice scores higher but is farther away,
// Bob scores lower but is closer — proving the list stays in SERVER (score)
// order and is never re-sorted locally by distance.
export const rawRows = [
  { candidate: { id: 'c1', name: 'Alice', city: 'Amersfoort', function_title: 'Verzorgende IG', status: 'available', status_label: 'Beschikbaar', status_color: '#79B58E', lat: '52.20', lng: '5.40' },
    distance_km: '5.2', score: 92, criteria: [], ai_advised: false, ai_advice_reason: null },
  { candidate: { id: 'c2', name: 'Bob', city: 'Utrecht', function_title: 'Verzorgende IG', status: 'available', status_label: 'Beschikbaar', status_color: '#79B58E', lat: '52.10', lng: '5.13' },
    distance_km: '1.1', score: 60, criteria: [], ai_advised: true, ai_advice_reason: 'Sterke fit qua ervaring.' },
]
/* eslint-enable no-restricted-syntax */
