import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

test('sync is standalone, detects drift and preserves the last snapshot on unsupported input', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'address-book-sync-'))
  const source = path.join(temp, 'source')
  const target = path.join(temp, 'target')
  const data = JSON.parse(
    fs.readFileSync('src/data/playbooks/snapshot.json', 'utf8'),
  )
  const script = path.resolve('scripts/sync-playbooks.mjs')
  const write = (name: string, value: unknown) => {
    const file = path.join(source, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(value))
  }
  fs.mkdirSync(target)
  try {
    write('src/data/country-playbooks/index.json', data.index)
    for (const [code, p] of Object.entries(data.playbooks))
      write(`src/data/country-playbooks/${code}.json`, p)
    write('openapi/internal/payment-model.json', data.model)
    write('openapi/internal/complementary-info.json', data.complementaryInfo)
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [script, ...args], {
        cwd: target,
        stdio: 'pipe',
      })
    run('--source', source)
    run('--check')
    run('--source', source, '--check')
    const file = path.join(target, 'src/data/playbooks/snapshot.json')
    const before = fs.readFileSync(file, 'utf8')
    data.playbooks.HK.paymentMethods[0].payoutCurrencies[0].requirements[0].details =
      'Updated upstream helper text'
    write('src/data/country-playbooks/HK.json', data.playbooks.HK)
    assert.throws(() => run('--source', source, '--check'))
    run('--source', source)
    assert.notEqual(fs.readFileSync(file, 'utf8'), before)
    const valid = fs.readFileSync(file, 'utf8')
    data.playbooks.HK.schemaVersion = '99.0'
    write('src/data/country-playbooks/HK.json', data.playbooks.HK)
    assert.throws(() => run('--source', source))
    assert.equal(fs.readFileSync(file, 'utf8'), valid)
    fs.rmSync(source, { recursive: true })
    run('--check')
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})
