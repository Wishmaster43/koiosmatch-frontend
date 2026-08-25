/**
 * KpiOrderList — regression for the F6 round-2 verifier blocker: a search
 * filter must never let the reorder handles PUT a filtered SUBSET as the
 * role's full KPI list. Omission from the PUT body means "hidden" server-side
 * (dashboardsKpiApi.ts), so reordering while filtered used to silently switch
 * off every non-matching KPI.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import KpiOrderList from './KpiOrderList'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const td = (key: string) => i18n.t(key, { ns: 'dashboard' })
const ct = (key: string) => i18n.t(key, { ns: 'common' })

describe('KpiOrderList — reorder under an active search filter', () => {
  it('merges the reordered visible subset back into the full onIds list, never truncating it', async () => {
    const onSaveOrder = vi.fn()
    render(
      <KpiOrderList
        role="admin" apiRole="default" migrated
        isHidden={() => false} onToggle={() => {}} onSaveOrder={onSaveOrder}
        roleKpis={{ default: ['candidates', 'opps', 'occupancy'] }} order={{}}
        resolveOrder={(_saved, visible) => visible}
        catalogByKey={null}
        // "t" matches the nl labels for 'candidates' and 'occupancy' but not
        // 'opps' ("Kansen in pijplijn" has no 't") — filters 'opps' out.
        search="t" onOffFilter="all"
        t={t as unknown as never} td={td as unknown as never}
      />
    )

    expect(screen.getByText(td('kpi.candidatesTotal'))).toBeInTheDocument()
    expect(screen.getByText(td('kpi.occupancy'))).toBeInTheDocument()
    expect(screen.queryByText(td('kpi.opportunities'))).not.toBeInTheDocument()

    // Reorder the two visible rows (candidates first, move it down past occupancy).
    const moveDownButtons = screen.getAllByRole('button', { name: ct('dragList.moveDown') })
    expect(moveDownButtons).toHaveLength(2)
    await userEvent.click(moveDownButtons[0])

    // The filtered-out 'opps' must survive in the saved list, in its original
    // slot — only the two visible ids swap places around it.
    expect(onSaveOrder).toHaveBeenCalledWith('admin', ['occupancy', 'opps', 'candidates'])
  })
})
