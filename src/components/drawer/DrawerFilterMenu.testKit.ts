/** DrawerFilterMenu · shared filter fixture builder (plain data, used by the split test files). */
import { vi } from 'vitest'
import type { DrawerFilterConfig } from './DrawerFilterMenu'

// Two filter rows mirror the real hosts: NotesTab (type + channel) and
// DocumentsSection (type only) both hand this component the SAME shape.
export const makeFilters = (over: Partial<{ typeValue: string; channelValue: string; onTypeChange: (v: string) => void; onChannelChange: (v: string) => void }> = {}): DrawerFilterConfig[] => [
  {
    type: 'single', key: 'type', label: 'Type', value: over.typeValue ?? '',
    options: [{ value: 'call', label: 'Call' }, { value: 'email', label: 'Email' }],
    onChange: over.onTypeChange ?? vi.fn(), allLabel: 'All types',
  },
  {
    type: 'single', key: 'channel', label: 'Channel', value: over.channelValue ?? '',
    options: [{ value: 'phone', label: 'Phone' }, { value: 'whatsapp', label: 'WhatsApp' }],
    onChange: over.onChannelChange ?? vi.fn(), allLabel: 'All channels',
  },
]
