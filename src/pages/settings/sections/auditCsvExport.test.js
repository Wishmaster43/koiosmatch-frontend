/**
 * exportAuditCsv — pins the who-column (K-139): actor_label wins over
 * causer_name, with and without an email; falls back to causer_name.
 * The download side effect is stubbed; the assertion reads the Blob csv.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportAuditCsv } from './auditCsvExport'

const t = (key, opts) => opts?.defaultValue ?? key

// Capture the csv text handed to the Blob instead of downloading it.
let captured
beforeEach(() => {
  captured = null
  vi.stubGlobal('Blob', class { constructor(parts) { captured = parts.join('') } })
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
  const a = { click: vi.fn(), set href(_) {}, set download(_) {} }
  vi.spyOn(document, 'createElement').mockReturnValue(a)
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => a)
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => a)
})

describe('exportAuditCsv — who column', () => {
  it('prefers actor_label over causer_name, keeping the email suffix', () => {
    exportAuditCsv([{ created_at: '2026-08-01T10:00:00Z', causer_name: 'Danny', causer_email: 'd@x.nl', actor_label: 'Flow-KoiosAI', log_name: 'candidate' }], t)
    expect(captured).toContain('Flow-KoiosAI (d@x.nl)')
    expect(captured).not.toContain('Danny (')
  })

  it('falls back to causer_name when actor_label is absent', () => {
    exportAuditCsv([{ created_at: '2026-08-01T10:00:00Z', causer_name: 'Danny', log_name: 'candidate' }], t)
    expect(captured).toContain('Danny')
  })
})
