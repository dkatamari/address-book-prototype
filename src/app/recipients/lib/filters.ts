import type { AccountPurpose } from './types.ts'
export const purposeFilters = [
  { value: 'all', label: 'Enabled for: All' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdraw', label: 'Withdraw/Send' },
  { value: 'both', label: 'Deposit & Withdraw/Send' },
]
export function matchesPurpose(
  purposes: AccountPurpose[] | undefined,
  filter: string,
): boolean {
  if (filter === 'all') return true
  if (filter === 'both')
    return !!purposes?.includes('deposit') && !!purposes?.includes('withdraw')
  if (filter === 'deposit' || filter === 'withdraw')
    return purposes?.includes(filter) ?? false
  return false
}
