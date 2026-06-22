/**
 * PlanningTab — the customer-level planning summary ("currently at work +
 * upcoming"). The PlanningSummary component is itself module-gated, so this tab
 * shows a calm note when the tenant has no Planning module.
 */
import PlanningSummary from './PlanningSummary'

export default function PlanningTab({ customerId }) {
  return <PlanningSummary customerId={customerId} />
}
