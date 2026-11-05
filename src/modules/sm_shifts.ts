// sm_shifts module — sync shifts (diensten) from Shiftmanager into the mirror.
import ShiftManagerMark from '../components/ui/ShiftManagerMark'
import { SM_CONNECTION_FIELD, smLimitField } from './_smFields'

export default {
  type:  'sm_shifts',
  // GET/read side: gated on the reports MODULE 'sm' (Danny 23-07); the connector app only gates the POST/PATCH coupling side.
  module: 'sm',
  category: 'shiftmanager',
  label: 'Shifts',
  Icon:  ShiftManagerMark,
  color: 'var(--module-shiftmanager)',
  bg:    'color-mix(in srgb, var(--module-shiftmanager) 8%, transparent)',
  // Only fields the sync actually reads (client/status were dead leftovers).
  schema: [
    SM_CONNECTION_FIELD,
    { key: 'date_from', label: 'Date from',  type: 'date' },
    { key: 'date_to',   label: 'Date to',  type: 'date' },
    { key: 'offset_from_days', label: 'Window from (days)', type: 'number', placeholder: '-30', hint: 'Relative window measured from today, negative means back in time. Only used when no dates are filled in.' },
    { key: 'offset_to_days', label: 'Window to (days)', type: 'number', placeholder: '180', hint: 'Relative window measured from today. Only used when no dates are filled in.' },
    smLimitField(500),
  ],
}
