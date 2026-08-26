/**
 * SettingItem — renders one registry item by its declared strategy:
 * render() → schema → component. Centralised so the shell stays dumb and adding
 * a `schema`-based item needs no shell changes.
 */
import SchemaSection from './SchemaSection'

// See the file's top doc above; picks the right render strategy so the shell needs no change when a new registry item is added.
export default function SettingItem({ item }) {
  if (!item) return null
  if (item.render)    return item.render()
  if (item.schema)    return <SchemaSection schema={item.schema} />
  if (item.component) { const C = item.component; return <C /> }
  return null
}
