/**
 * SettingItem — renders one registry item by its declared strategy:
 * render() → schema → component. Centralised so the shell stays dumb and adding
 * a `schema`-based item needs no shell changes.
 */
import SchemaSection from './SchemaSection'

export default function SettingItem({ item }) {
  if (!item) return null
  if (item.render)    return item.render()
  if (item.schema)    return <SchemaSection schema={item.schema} />
  if (item.component) { const C = item.component; return <C /> }
  return null
}
