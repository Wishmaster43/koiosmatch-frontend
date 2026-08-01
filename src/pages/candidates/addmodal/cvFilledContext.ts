/**
 * CvFilledContext — the form fields a parsed CV filled and the recruiter has not
 * checked yet. Its own module for two reasons: the card components read it without
 * anyone drilling the set through two levels (§3), and `fields.tsx` stays a
 * components-only file so fast refresh keeps working there.
 */
import { createContext } from 'react'

export const CvFilledContext = createContext<ReadonlySet<string>>(new Set<string>())
