/**
 * fields.test.tsx — regression coverage for DateField's local-day conversion
 * (Danny 09-08, UTC-date-shift fix). This is the SHARED DateField every form
 * uses, so a bug here silently propagates to every consumer — proving the
 * SENT value is the picked local day, not a UTC-shifted one, matters most here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import 'react-datepicker/dist/react-datepicker.css'
import { DateField } from './fields'

// This project ships no @types/node; process.env.TZ is a genuine Node global at
// test runtime (Vitest runs under Node) — this is a minimal local type shim for it.
declare const process: { env: Record<string, string | undefined> }

describe('DateField · sends the LOCAL calendar day, never a UTC-shifted one', () => {
  const originalTz = process.env.TZ
  beforeEach(() => {
    // Explicit TZ so this proves something on any machine, not just one that
    // happens to run in UTC (where old-buggy and fixed code would coincide).
    process.env.TZ = 'Europe/Amsterdam'
    // Freeze "now" just after local midnight (CET, winter) — the exact window
    // where `.toISOString().slice(0, 10)` rolled the picked day back by one
    // (measured 09-08: picking 15 Jan 2026 saved as "2026-01-14"). Only Date is
    // faked, so userEvent's own internal timers keep ticking normally.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 15, 0, 30, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
    process.env.TZ = originalTz
  })

  it('reports the picked "today" cell as 2026-01-15, not 2026-01-14', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateField value={null} onChange={onChange} />)
    await user.click(screen.getByRole('textbox'))
    // The calendar renders into the shared datepicker-portal (outside the RTL
    // container), so query the document like a real user would see it.
    const todayCell = document.querySelector('.react-datepicker__day--today') as HTMLElement
    expect(todayCell).toBeTruthy()
    await user.click(todayCell)
    expect(onChange).toHaveBeenCalledWith('2026-01-15')
  })
})
