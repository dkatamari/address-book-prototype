import type { Draft, Recipient } from './types.ts'

export function accountStatus(account: Recipient): 'pending_review' | 'active' {
  // Bundled examples represent approved accounts. Older user-created records
  // have no approval evidence, so they remain pending until explicitly approved.
  return account.status ?? (account.demo ? 'active' : 'pending_review')
}
export function accountStatusLabel(account: Recipient): string {
  return accountStatus(account) === 'active' ? 'Active' : 'Pending review'
}
export function submitForReview(
  draft: Draft,
): Draft & Pick<Recipient, 'status' | 'demo'> {
  // This override also applies when an edited draft contains an old status.
  return { ...draft, status: 'pending_review', demo: undefined }
}
