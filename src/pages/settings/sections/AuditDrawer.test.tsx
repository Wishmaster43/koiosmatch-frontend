/**
 * AuditDrawer — regression for K004-AUDIT-SCRUB-1: an erased candidate/contact's
 * activity row carries `{ scrubbed: true, reason: 'avg_erasure_request' }` in place
 * of its normal diff bag. The drawer must show the AVG notice, never a before/after
 * diff — and a normal entry beside it must still render its diff unchanged.
 * Real i18n (nl) so `t()` resolves genuine copy, same pattern as AuditLog.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { AuditDrawer } from './AuditDrawer'
import type { AuditEntry } from './auditShared'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('AuditDrawer · K004-AUDIT-SCRUB-1', () => {
  it('shows the scrubbed notice and no before/after rows for a scrubbed entry', () => {
    const entry: AuditEntry = {
      id: 1, event: 'updated', log_name: 'candidates', description: 'Bijgewerkt',
      created_at: '2026-10-01T10:00:00Z', causer_name: 'Danny Polak',
      subject_type: 'Candidate', subject_label: 'Jan Jansen',
      properties: { scrubbed: true, reason: 'avg_erasure_request' },
    }
    render(<AuditDrawer entry={entry} onClose={() => {}} />)
    expect(screen.getByText(st('audit.scrubbedNotice'))).toBeInTheDocument()
    expect(screen.queryByText(st('audit.oldValue'))).not.toBeInTheDocument()
    expect(screen.queryByText(st('audit.newValue'))).not.toBeInTheDocument()
  })

  it('still shows a normal before/after diff for a non-scrubbed entry', () => {
    const entry: AuditEntry = {
      id: 2, event: 'updated', log_name: 'candidates', description: 'Bijgewerkt',
      created_at: '2026-10-01T10:00:00Z', causer_name: 'Danny Polak',
      changes: { attributes: { first_name: 'Nieuwe naam' }, old: { first_name: 'Oude naam' } },
    }
    render(<AuditDrawer entry={entry} onClose={() => {}} />)
    expect(screen.queryByText(st('audit.scrubbedNotice'))).not.toBeInTheDocument()
    expect(screen.getByText('Oude naam')).toBeInTheDocument()
    expect(screen.getByText('Nieuwe naam')).toBeInTheDocument()
  })
})
