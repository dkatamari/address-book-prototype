import type { Draft, Snapshot } from './types.ts'
import { BANK, resolve } from './requirements.ts'
import { clearingCodeLabel } from './clearing-labels.ts'

export function routingSummary(snapshot: Snapshot, draft: Draft): string {
  if (draft.kind === 'stablecoin') return draft.network
  const bic = draft.values[BANK + 'bic']?.trim()
  if (bic) return `BIC: ${bic}`
  const code = draft.values[BANK + 'clearingSystemMemberId']?.trim()
  if (!code) return 'Code not provided'
  // Resolve the selected country/currency profile, including conditional rules
  // and optional clearing identifiers. Keep the stored identifier unchanged.
  const { values } = resolve(snapshot, draft)
  return `${clearingCodeLabel(values[BANK + 'clearingSystemCode'])}: ${code}`
}
