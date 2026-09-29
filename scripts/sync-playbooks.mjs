import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const output = path.resolve('src/data/playbooks/snapshot.json')
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
export function collectFields(model, root, prefix) {
  const schemas = model.components.schemas
  const result = {}
  function resolve(schema, visited = []) {
    if (schema.$ref) {
      const name = decodeURIComponent(schema.$ref.split('/').at(-1))
      if (visited.includes(name)) throw new Error(`Recursive schema ${name}`)
      if (!schemas[name]) throw new Error(`Unresolved schema ${name}`)
      return {
        ...resolve(schemas[name], [...visited, name]),
        ...Object.fromEntries(
          Object.entries(schema).filter(([k]) => k !== '$ref'),
        ),
      }
    }
    if (schema.allOf)
      return Object.assign(
        {},
        ...schema.allOf.map((x) => resolve(x, visited)),
        Object.fromEntries(
          Object.entries(schema).filter(([k]) => k !== 'allOf'),
        ),
      )
    return schema
  }
  function walk(schema, key) {
    const s = resolve(schema)
    result[key] = {
      type: s.type ?? (s.properties ? 'object' : 'string'),
      ...(s.enum ? { enum: s.enum } : {}),
      ...(s.description ? { description: s.description } : {}),
      ...(s.required ? { required: s.required } : {}),
      ...(s.pattern ? { pattern: s.pattern } : {}),
    }
    for (const [name, prop] of Object.entries(s.properties ?? {}))
      walk(prop, `${key}.${name}`)
  }
  walk(schemas[root], prefix)
  return result
}
export function validate(snapshot) {
  const { index, playbooks, model, complementaryInfo } = snapshot
  if (index.schemaVersion !== '2.0')
    throw new Error('Unsupported country index schema')
  const fields = {
    ...collectFields(model, 'Payment', 'payment'),
    ...collectFields(
      complementaryInfo,
      'Complementary Info',
      'payment.complementaryInfo',
    ),
  }
  const seen = new Set()
  const normalizations = new Set([
    'TRIM',
    'REMOVE_WHITESPACE',
    'UPPERCASE',
    'LOWERCASE',
  ])
  function expression(e) {
    if (!e || Object.keys(e).length !== 1)
      throw new Error('Invalid requirement expression')
    if (e.field) {
      if (!fields[e.field.path])
        throw new Error(`Unknown canonical field ${e.field.path}`)
      for (const key of Object.keys(e.field.constraints ?? {}))
        if (
          !['const', 'pattern', 'length', 'minLength', 'maxLength'].includes(
            key,
          )
        )
          throw new Error(`Unsupported constraint ${key}`)
      if (e.field.constraints?.pattern) new RegExp(e.field.constraints.pattern)
      for (const n of e.field.normalization ?? [])
        if (!normalizations.has(n))
          throw new Error(`Unsupported normalization ${n}`)
    } else {
      const children = e.allOf ?? e.anyOf
      if (!Array.isArray(children) || !children.length)
        throw new Error('Unsupported expression operator')
      children.forEach(expression)
    }
  }
  function rule(r) {
    if (!['REQUIRED', 'CONDITIONAL', 'OPTIONAL'].includes(r.requirementLevel))
      throw new Error(`Unsupported requiredness ${r.id}`)
    if (typeof r.details !== 'string' || typeof r.notes !== 'string')
      throw new Error(`Missing requirement metadata ${r.id}`)
    expression(r.expression)
  }
  for (const entry of index.countries) {
    const code = entry.countryCode
    if (
      !/^[A-Z]{2}$/.test(code) ||
      entry.file !== `${code}.json` ||
      seen.has(code)
    )
      throw new Error('Invalid country index entry')
    seen.add(code)
    const p = playbooks[code]
    if (!p || p.schemaVersion !== '2.0' || p.destination.country.code !== code)
      throw new Error(`Invalid playbook ${code}`)
    for (const m of p.paymentMethods) {
      if (m.id !== 'BANK') throw new Error(`Unsupported payment method ${m.id}`)
      for (const c of m.payoutCurrencies) c.requirements.forEach(rule)
    }
    for (const r of p.regulatoryRequirements) r.dataRequirements.forEach(rule)
  }
  if (seen.size !== Object.keys(playbooks).length)
    throw new Error('Playbook index mismatch')
  return fields
}
const check = process.argv.includes('--check')
const sourceIndex = process.argv.indexOf('--source')
if (check && sourceIndex === -1) {
  const snapshot = read(output)
  const fields = validate(snapshot)
  if (hash(fields) !== hash(snapshot.fields))
    throw new Error('Generated field metadata changed without sync')
  for (const [key, value] of Object.entries({
    index: snapshot.index,
    model: snapshot.model,
    complementaryInfo: snapshot.complementaryInfo,
    ...snapshot.playbooks,
  })) {
    if (hash(value) !== snapshot.source.hashes[key])
      throw new Error(`Snapshot changed without sync: ${key}`)
  }
  console.log(
    `Verified standalone snapshot: ${snapshot.index.countries.length} destinations`,
  )
} else {
  const source = path.resolve(
    sourceIndex === -1
      ? '../axiym-partner-api-docs'
      : process.argv[sourceIndex + 1],
  )
  const index = read(path.join(source, 'src/data/country-playbooks/index.json'))
  const playbooks = Object.fromEntries(
    index.countries.map((entry) => {
      if (!/^[A-Z]{2}\.json$/.test(entry.file))
        throw new Error('Invalid country filename')
      return [
        entry.countryCode,
        read(path.join(source, 'src/data/country-playbooks', entry.file)),
      ]
    }),
  )
  const model = read(path.join(source, 'openapi/internal/payment-model.json'))
  const complementaryInfo = read(
    path.join(source, 'openapi/internal/complementary-info.json'),
  )
  const hashes = Object.fromEntries(
    Object.entries({ index, model, complementaryInfo, ...playbooks }).map(
      ([key, value]) => [key, hash(value)],
    ),
  )
  const git = (...args) => {
    try {
      return execFileSync('git', ['-C', source, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      return 'unavailable'
    }
  }
  const snapshot = {
    source: {
      repository: 'axiym-partner-api-docs',
      revision: git('rev-parse', 'HEAD'),
      dirty:
        git(
          'status',
          '--porcelain',
          '--',
          'src/data/country-playbooks',
          'openapi/internal',
        ) !== '',
      hashes,
    },
    index,
    playbooks,
    model,
    complementaryInfo,
  }
  snapshot.fields = validate(snapshot)
  const previous = fs.existsSync(output) ? read(output) : undefined
  const changed = Object.keys(hashes).filter(
    (key) => hashes[key] !== previous?.source.hashes[key],
  )
  const removed = Object.keys(previous?.source.hashes ?? {}).filter(
    (key) => !(key in hashes),
  )
  console.log(
    `Changed: ${changed.join(', ') || 'none'}; removed: ${removed.join(', ') || 'none'}`,
  )
  if (check) {
    if (changed.length || removed.length) process.exitCode = 1
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(`${output}.tmp`, JSON.stringify(snapshot, null, 2) + '\n')
    fs.renameSync(`${output}.tmp`, output)
    console.log(
      `Imported ${index.countries.length} country playbooks. No backend required.`,
    )
  }
}
