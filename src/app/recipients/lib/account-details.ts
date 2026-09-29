import type { Recipient, Snapshot } from './types.ts'
import { ACCOUNT, BANK, NAME, label, resolve } from './requirements.ts'
import { displayFieldValue } from './identification.ts'
import { businessRelationshipLabel } from './business-relationship.ts'
import { purposeBadge } from './form-flow.ts'

// Use current playbook labels, while displaying only the original saved values.
export function accountDetailItems(
  snapshot: Snapshot,
  account: Recipient,
  countryName: (code: string) => string,
) {
  const labels = new Map(
    account.kind === 'bank'
      ? resolve(snapshot, account).fields.map((field) => [
          field.path,
          field.label,
        ])
      : [],
  )
  const entries = Object.entries(account.values).filter(
    ([path, value]) =>
      value &&
      path !== NAME &&
      path !== ACCOUNT &&
      !path.startsWith('payment.creditor.party.address.') &&
      !path.endsWith('.partyType') &&
      path !== BANK + 'clearingSystemCode' &&
      path !== BANK + 'address.country',
  )
  // Bank details come first; contact and other party information follow below.
  entries.sort(
    ([a], [b]) => Number(b.startsWith(BANK)) - Number(a.startsWith(BANK)),
  )
  const items = entries.map(([path, value]) => ({
    id: path,
    label: labels.get(path) ?? label(path),
    value:
      path.endsWith('.country') ||
      path.endsWith('.issuerCountry') ||
      path.endsWith('.countryOfResidence')
        ? countryName(value)
        : displayFieldValue(path, value),
  }))
  if (account.kind === 'bank' && account.bankAddress) {
    const nameIndex = items.findIndex((item) => item.id === BANK + 'name')
    items.splice(nameIndex < 0 ? 0 : nameIndex + 1, 0, {
      id: 'addressBook.bankAddress',
      label: 'Bank Address',
      value: account.bankAddress,
    })
  }
  items.push(
    {
      id: 'addressBook.ownership',
      label: 'Ownership',
      value:
        account.relationship === 'own' ? 'Own account' : 'External account',
    },
    {
      id: 'addressBook.accountPurposes',
      label: 'Enabled for',
      value: purposeBadge(account.accountPurposes) ?? 'Not specified',
    },
  )
  if (account.kind === 'bank')
    items.push({
      id: BANK + 'address.country',
      label: 'Bank country',
      value: countryName(
        account.values[BANK + 'address.country'] || account.country,
      ),
    })
  if (account.relationship === 'external' && account.businessRelationship)
    items.push({
      id: 'addressBook.businessRelationship',
      label: 'Relationship',
      value: businessRelationshipLabel(account.businessRelationship),
    })
  if (account.accountReason)
    items.push({
      id: 'addressBook.accountReason',
      label: 'Reason For Adding This Account',
      value: account.accountReason,
    })
  return items
}
