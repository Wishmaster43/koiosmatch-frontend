/**
 * labelOrRaw adopters in components/reports: each badge/filter resolves a KNOWN value through the
 * real i18n catalogue (translated branch) and shows an OPEN-ENDED server value as its own text
 * (raw-fallback branch). Copy is read through the real i18n instance, never a literal.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import RunStepList from './RunStepList'
import { StatusBadge as RunStatusBadge } from './runFormat'
import { ChannelBadge, StatusBadge as MessageStatusBadge } from './messages/messageParts'
import CandidateDetailDrawer from './CandidateDetailDrawer'
import MessagesTable from './MessagesTable'
import { buildStatusGroup } from './reportFilterDefs'
import type { MessageRow, ReportCandidate, RunStep } from '@/types/reports'

vi.mock('@/components/layout/workflow/useModuleCatalog', () => ({ useModuleCatalog: () => ({ catalog: {} }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))

const rows: MessageRow[] = [
  { id: 1, channel: 'whatsapp', status: 'sent' } as MessageRow,
  { id: 2, channel: 'carrier_pigeon', status: 'mystery_state' } as MessageRow,
]
vi.mock('./useReportList', () => ({ useReportList: () => ({ rows, loading: false, error: false }) }))
// Capture the filter groups MessagesTable builds; the real hook needs the right-panel context.
const captured = vi.hoisted(() => ({ groups: [] as Array<{ key: string; options?: Array<{ value: string | number; label: string }> }> }))
vi.mock('./useReportTableFilter', () => ({
  useReportTableFilter: ({ rows: r, filterGroupsConfig }: { rows: unknown[]; filterGroupsConfig: typeof captured.groups }) => {
    captured.groups = filterGroupsConfig
    return { filtered: r, sorted: r }
  },
}))

const rt = (key: string) => i18n.t(key, { ns: 'reports' })
const optionLabel = (group: string, value: string) =>
  captured.groups.find(g => g.key === group)?.options?.find(o => o.value === value)?.label

describe('RunStepList step messages', () => {
  const step = (status: string): RunStep => ({ label: 'Send', status: 'completed', ok: true,
    messages: [{ recipient_label: 'R', channel: 'wa_web', status, outbox_id: 'o1' }] } as RunStep)
  it('translates a known message status', () => {
    render(<RunStepList steps={[step('queued')]} />)
    expect(screen.getByText(rt('runs.drawer.messages.status.queued'))).toBeInTheDocument()
  })
  it('shows an unknown message status raw', () => {
    render(<RunStepList steps={[step('mystery_state')]} />)
    expect(screen.getByText('mystery_state')).toBeInTheDocument()
  })
})

describe('runFormat StatusBadge', () => {
  it('translates a known run status', () => {
    render(<RunStatusBadge status="success" />)
    expect(screen.getByText(rt('runs.status.success'))).toBeInTheDocument()
  })
  it('shows an unknown run status raw', () => {
    render(<RunStatusBadge status="mystery_state" />)
    expect(screen.getByText('mystery_state')).toBeInTheDocument()
  })
})

describe('messageParts badges', () => {
  it('translates a known channel and status', () => {
    render(<><ChannelBadge channel="email" /><MessageStatusBadge status="delivered" /></>)
    expect(screen.getByText(rt('messages.channel.email'))).toBeInTheDocument()
    expect(screen.getByText(rt('messages.status.delivered'))).toBeInTheDocument()
  })
  it('shows an unknown channel and status raw', () => {
    render(<><ChannelBadge channel="carrier_pigeon" /><MessageStatusBadge status="mystery_state" /></>)
    expect(screen.getByText('carrier_pigeon')).toBeInTheDocument()
    expect(screen.getByText('mystery_state')).toBeInTheDocument()
  })
})

describe('CandidateDetailDrawer status label', () => {
  const cand = (status: string) => ({ id: 1, firstname: 'A', lastname: 'B', status } as ReportCandidate)
  it('translates a known status', () => {
    render(<CandidateDetailDrawer candidate={cand('actief')} onClose={() => {}} />)
    expect(screen.getByText(rt('candidates.status.actief'))).toBeInTheDocument()
  })
  it('shows an unknown status raw', () => {
    render(<CandidateDetailDrawer candidate={cand('mystery_state')} onClose={() => {}} />)
    expect(screen.getByText('mystery_state')).toBeInTheDocument()
  })
})

describe('MessagesTable', () => {
  it('translates known channel/status in the filter groups and falls back to raw for unknown ones', () => {
    render(<MessagesTable />)
    expect(optionLabel('channel', 'whatsapp')).toBe(rt('messages.channel.whatsapp'))
    expect(optionLabel('channel', 'carrier_pigeon')).toBe('carrier_pigeon')
    expect(optionLabel('status', 'sent')).toBe(rt('messages.status.sent'))
    expect(optionLabel('status', 'mystery_state')).toBe('mystery_state')
  })
})

describe('buildStatusGroup raw fallback', () => {
  it('uses the server value when the catalogue has no key for it', () => {
    const group = buildStatusGroup(i18n.getFixedT(null, 'reports'), { exists: (k, o) => i18n.exists(k, o) },
      ['mystery_state'], [], [{ status: 'mystery_state' }], 'messages.filters.status', () => {})
    expect(group.options?.[0].label).toBe('mystery_state')
  })
})
