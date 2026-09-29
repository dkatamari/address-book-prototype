import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  accountStatus,
  accountStatusLabel,
  submitForReview,
} from '../src/app/recipients/lib/account-status.ts'
import {
  parseRecipients,
  serializeRecipients,
} from '../src/app/recipients/lib/storage.ts'
import type { Recipient } from '../src/app/recipients/lib/types.ts'
const account: Recipient = {
  id: 'test',
  kind: 'bank',
  relationship: 'own',
  country: 'HK',
  currency: 'HKD',
  network: '',
  values: {},
  createdAt: '',
  updatedAt: '',
}

test('new bank and wallet submissions stay pending review across reloads', () => {
  for (const kind of ['bank', 'stablecoin'] as const) {
    const submitted = { ...account, ...submitForReview({ ...account, kind }) }
    const [reloaded] = parseRecipients(serializeRecipients([submitted]))
    assert.equal(accountStatus(reloaded), 'pending_review')
    assert.equal(accountStatusLabel(reloaded), 'Pending review')
    assert.equal(reloaded.status, 'pending_review')
  }
})
test('editing an approved account requires review again, including demo accounts', () => {
  const approved: Recipient = { ...account, status: 'active', demo: true }
  assert.equal(accountStatusLabel(approved), 'Active')
  const submitted = { ...approved, ...submitForReview(approved) }
  assert.equal(accountStatus(submitted), 'pending_review')
  assert.equal(submitted.demo, undefined)
  assert.equal(approved.status, 'active')
})
test('legacy records never imply approval unless they are bundled examples', () => {
  assert.equal(accountStatus(account), 'pending_review')
  assert.equal(accountStatus({ ...account, demo: true }), 'active')
  assert.equal(
    accountStatus({ ...account, demo: true, status: 'pending_review' }),
    'pending_review',
  )
  const approved: Recipient = { ...account, status: 'active' }
  assert.equal(
    accountStatus(parseRecipients(serializeRecipients([approved]))[0]),
    'active',
  )
  assert.throws(() =>
    parseRecipients(
      JSON.stringify({
        version: 1,
        recipients: [{ ...account, status: 'unknown' }],
      }),
    ),
  )
})
