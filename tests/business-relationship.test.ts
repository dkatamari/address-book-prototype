import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  businessRelationships,
  businessRelationshipErrors,
  savedBusinessRelationship,
} from '../src/app/recipients/lib/business-relationship.ts'
import { stepErrors } from '../src/app/recipients/lib/form-flow.ts'
import { changeOwnership } from '../src/app/recipients/lib/party-details.ts'
import {
  parseRecipients,
  serializeRecipients,
} from '../src/app/recipients/lib/storage.ts'
import type { Draft } from '../src/app/recipients/lib/types.ts'
const draft: Draft = {
  kind: 'bank',
  relationship: 'external',
  country: '',
  currency: '',
  network: '',
  values: {},
}

test('external bank and wallet accounts require a valid relationship in Party Details', () => {
  for (const kind of ['bank', 'stablecoin'] as const) {
    const d = { ...draft, kind }
    const missing = businessRelationshipErrors(d)
    assert.ok(stepErrors(1, missing, []).businessRelationship)
    assert.deepEqual(stepErrors(0, missing, []), {})
    assert.ok(
      businessRelationshipErrors({ ...d, businessRelationship: 'supplier' })
        .businessRelationship,
    )
    for (const { value } of businessRelationships) {
      assert.deepEqual(
        businessRelationshipErrors({ ...d, businessRelationship: value }),
        {},
      )
      assert.equal(
        savedBusinessRelationship({ ...d, businessRelationship: value }),
        value,
      )
    }
  }
})
test('ownership switching restores the external selection but excludes it from a saved own account', () => {
  const external = { ...draft, businessRelationship: 'SUPPLIER' }
  const own = changeOwnership(external, 'own', {})
  assert.deepEqual(businessRelationshipErrors(own), {})
  assert.equal(savedBusinessRelationship(own), undefined)
  const restored = changeOwnership(own, 'external', {})
  assert.equal(savedBusinessRelationship(restored), 'SUPPLIER')
})
test('relationship codes persist, older accounts still load, and invalid codes are rejected', () => {
  const older = { ...draft, id: 'account', createdAt: '', updatedAt: '' }
  assert.deepEqual(parseRecipients(serializeRecipients([older])), [older])
  const account = { ...older, businessRelationship: 'SERVICE_PROVIDER' }
  assert.deepEqual(parseRecipients(serializeRecipients([account])), [account])
  assert.throws(() =>
    parseRecipients(
      serializeRecipients([{ ...account, businessRelationship: 'unknown' }]),
    ),
  )
})
