import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesPurpose } from '../src/app/recipients/lib/filters.ts'
import type { AccountPurpose } from '../src/app/recipients/lib/types.ts'

test('purpose filters include dual-purpose accounts in each direction and only both in the combined filter', () => {
  const accounts: { id: string; purposes?: AccountPurpose[] }[] = [
    { id: 'deposit', purposes: ['deposit'] },
    { id: 'withdraw', purposes: ['withdraw'] },
    { id: 'both', purposes: ['deposit', 'withdraw'] },
    { id: 'older' },
    { id: 'empty', purposes: [] },
  ]
  const matching = (filter: string) =>
    accounts
      .filter((account) => matchesPurpose(account.purposes, filter))
      .map((account) => account.id)
  assert.deepEqual(matching('deposit'), ['deposit', 'both'])
  assert.deepEqual(matching('withdraw'), ['withdraw', 'both'])
  assert.deepEqual(matching('both'), ['both'])
  assert.deepEqual(matching('all'), [
    'deposit',
    'withdraw',
    'both',
    'older',
    'empty',
  ])
})
