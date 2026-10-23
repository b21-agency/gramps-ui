// RTK Query codegen for the Gramps Web API.
// Regenerate: pnpm api:generate   (refresh openapi.json first: pnpm api:fetch-spec)
const byTag = (...tags) => (_name, def) => (def.operation.tags ?? []).some((t) => tags.includes(t))

const slices = {
  people: ['People', 'DNA', 'Living', 'Relations', 'Timeline'],
  families: ['Families'],
  events: ['Events'],
  places: ['Places'],
  sources: ['Sources'],
  citations: ['Citations'],
  repositories: ['Repositories'],
  notes: ['Notes'],
  media: ['Media'],
  tags: ['Tags'],
  search: ['Search'],
  metadata: ['Metadata', 'Translations', 'Types', 'Name Formats', 'Name Groups', 'Holidays', 'Facts', 'Filters', 'Anniversaries', 'Config', 'api'],
  transactions: ['Transactions'],
  users: ['Users', 'Token', 'OIDC'],
  trees: ['Trees', 'Backups'],
  tasks: ['Tasks', 'Reports', 'Exporters', 'Importers', 'Chat'],
  bookmarks: ['Bookmarks'],
}

const outputFiles = {}
for (const [name, tags] of Object.entries(slices)) {
  outputFiles[`../${name}-api-slice.gen.ts`] = { filterEndpoints: byTag(...tags) }
}

module.exports = {
  schemaFile: './openapi.json',
  apiFile: '../index.ts',
  apiImport: 'api',
  exportName: 'api',
  hooks: { queries: true, lazyQueries: true, mutations: true },
  tag: true,
  endpointOverrides: [
    // POST because the strings go in the body, but it only reads: as a query it is cached
    { pattern: 'postTranslation', type: 'query' },
    // POST because the pasted match data goes in the body, but it only parses
    { pattern: 'postDnaMatchParser', type: 'query' },
  ],
  outputFiles,
}
