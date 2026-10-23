// Fixes for gaps in the Gramps Web OpenAPI spec, applied to openapi.json after every
// `pnpm api:fetch-spec` (idempotent). Codegen is only as good as the spec: an endpoint
// whose request body is missing generates without one, and would have to be hand-written.
// Each fix only fills in what upstream leaves out; once upstream describes it, it is a no-op.
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('./openapi.json', import.meta.url)
const spec = JSON.parse(readFileSync(file, 'utf8'))

const jsonArrayBody = (description: string) => ({
  required: true,
  description,
  content: { 'application/json': { schema: { type: 'array', items: { type: 'object', additionalProperties: true } } } },
})

const fixes = [
  // bulk user import: a list of {name, full_name, email, role}
  ['/api/users/', 'post', jsonArrayBody('Users to create.')],
  // several new objects in one transaction
  ['/api/objects/', 'post', jsonArrayBody('Gramps objects to add in one transaction.')],
  // commit a transaction, or with `undo` roll one back
  ['/api/transactions/', 'post', jsonArrayBody('Transaction entries (as returned by a write).')],
]

let changed = 0
for (const [path, method, requestBody] of fixes as Array<[string, string, object]>) {
  const op = spec.paths?.[path]?.[method]
  if (!op) throw new Error(`fix-spec: ${method.toUpperCase()} ${path} is not in the spec any more`)
  if (op.requestBody) continue
  op.requestBody = requestBody
  changed++
}

writeFileSync(file, JSON.stringify(spec, null, 2) + '\n')
console.log(`fix-spec: ${changed} fix(es) applied`)
