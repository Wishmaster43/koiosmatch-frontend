/**
 * WerkzoekenSettings (INTEGRATIONS-SETTINGS-1) — the Werkzoeken connector
 * section. v1 is the Connection card only: the mapping domains follow from
 * Danny's mapping session (contract: "werkzoeken volgt uit de mapping-sessie"),
 * so no Mapping tab renders until they exist — never an empty fake tab (§3).
 */
import IntegrationConnectionCard from './IntegrationConnectionCard'

// One card; the section grows sub-tabs once the wz mapping domains are decided.
export default function WerkzoekenSettings() {
  return <IntegrationConnectionCard connector="werkzoeken" />
}
