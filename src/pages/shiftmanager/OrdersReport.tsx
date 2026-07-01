// OrdersReport — page wrapper that renders the OrdersTable (shifts/orders report).
import OrdersTable from '@/components/shiftmanager/OrdersTable'

export default function OrdersReport() {
  return (
    <div className="flex flex-col h-full p-6">
      <OrdersTable />
    </div>
  )
}
