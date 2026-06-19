/**
 * SettingsDirtyContext — lets a section report unsaved-changes state up to the
 * settings shell, which warns before navigating away. The shell provides
 * `{ report(dirty) }`; the scaffold calls it. In its own file so both the kit and
 * the shell can import it without tripping the react-refresh "components only" rule.
 */
import { createContext } from 'react'

export const SettingsDirtyContext = createContext(null)
