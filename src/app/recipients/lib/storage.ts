import { ownPartyValues, normalizeContactValues } from './party-details.ts'
import { isBusinessRelationship } from './business-relationship.ts'
import type { Recipient } from './types'
export const STORAGE_KEY = 'axiym.address-book.v1'
// Drop the retired setting when reading or rewriting older saved accounts.
function withoutRetiredSettings(account: Recipient): Recipient {
  const clean: Recipient & { accountPurposes?: unknown } = { ...account }
  delete clean.accountPurposes
  return clean
}
export function parseRecipients(raw: string): Recipient[] {
  const value = JSON.parse(raw)
  if (value.version !== 1 || !Array.isArray(value.recipients))
    throw new Error('Unsupported address book format.')
  const ids = new Set<string>()
  for (const r of value.recipients) {
    if (
      !r ||
      typeof r.id !== 'string' ||
      ids.has(r.id) ||
      !['bank', 'stablecoin'].includes(r.kind) ||
      !['own', 'external'].includes(r.relationship) ||
      (r.status !== undefined &&
        !['pending_review', 'active'].includes(r.status)) ||
      (r.businessRelationship !== undefined &&
        !isBusinessRelationship(r.businessRelationship)) ||
      (r.bankAddress !== undefined && typeof r.bankAddress !== 'string') ||
      (r.accountReason !== undefined && typeof r.accountReason !== 'string') ||
      (r.supportingDocument !== undefined &&
        (!r.supportingDocument ||
          typeof r.supportingDocument.id !== 'string' ||
          typeof r.supportingDocument.name !== 'string' ||
          !Number.isInteger(r.supportingDocument.size) ||
          r.supportingDocument.size < 0 ||
          r.supportingDocument.size > 5 * 1024 * 1024)) ||
      !r.values ||
      Array.isArray(r.values) ||
      typeof r.values !== 'object' ||
      !Object.values(r.values).every((v) => typeof v === 'string') ||
      !['country', 'currency', 'network', 'createdAt', 'updatedAt'].every(
        (key) => typeof r[key] === 'string',
      )
    )
      throw new Error('Saved account data is invalid.')
    ids.add(r.id)
  }
  // Migrate retired settings; only bundled examples get updated party or network data.
  return value.recipients.map((stored: Recipient) => {
    const r = withoutRetiredSettings(stored)
    if (r.demo !== true) return r
    let account = r
    if (
      r.id === 'demo-wallet' &&
      r.kind === 'stablecoin' &&
      r.network === 'Ethereum'
    )
      account = { ...account, network: 'Avalanche' }
    const ownExample =
      r.relationship === 'own' &&
      ((r.kind === 'bank' && ['demo-hk', 'demo-cn'].includes(r.id)) ||
        (r.kind === 'stablecoin' && r.id === 'demo-wallet'))
    if (ownExample)
      account = {
        ...account,
        values: {
          ...account.values,
          ...normalizeContactValues({ ...ownPartyValues }),
        },
      }
    return account
  })
}
export function serializeRecipients(recipients: Recipient[]) {
  return JSON.stringify({
    version: 1,
    recipients: recipients.map(withoutRetiredSettings),
  })
}

// Populate an empty address book on load, without modifying nonempty or invalid data.
export function loadRecipients(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  defaults: Recipient[],
): Recipient[] {
  const raw = storage.getItem(STORAGE_KEY)
  const accounts = raw === null ? [] : parseRecipients(raw)
  if (accounts.length) {
    // Persist migrations without adding defaults to a nonempty address book.
    if (
      JSON.stringify(JSON.parse(raw!).recipients) !== JSON.stringify(accounts)
    )
      storage.setItem(STORAGE_KEY, serializeRecipients(accounts))
    return accounts
  }
  const serialized = serializeRecipients(defaults)
  const seeded = parseRecipients(serialized)
  storage.setItem(STORAGE_KEY, serialized)
  return seeded
}
