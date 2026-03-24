# openapi-client-ts-generator

Generate TypeScript types and API client (and TanStack Query helpers) from OpenAPI 3.0/3.1 specifications.

## CLI

### Basic

```bash
npx openapi-gen <input> -o <output-dir>
```

`<input>` can be a local file path or a URL.

```bash
# local file
npx openapi-gen ./openapi.yaml -o ./src/api

# URL
npx openapi-gen https://example.com/openapi.json -o ./src/api
```

This generates the following files in the output directory:

- `types.ts` — TypeScript types from `components.schemas`
- `client.ts` — Typed `apiClient` factory function from `paths`
- `index.ts` — Barrel re-export

### TanStack Query helpers

```bash
# React Query
npx openapi-gen ./openapi.yaml -o ./src/api --tanstack-query react

# Svelte Query
npx openapi-gen ./openapi.yaml -o ./src/api --tanstack-query svelte
```

Adds a `query.ts` file with `queryClient` helpers wrapping the API client.

### All options

| Option                      | Default | Description                                                            |
| --------------------------- | ------- | ---------------------------------------------------------------------- |
| `-o, --output <dir>`        | `.`     | Output directory                                                       |
| `--tanstack-query <name>`   | —       | TanStack Query framework: `react` or `svelte`                          |
| `--no-throw-on-http-error`  | —       | Do not throw `HTTPError` on non-2xx responses                          |
| `--allow-x-typescript-type` | —       | Enable `x-typescript-type` extension (trusted sources only, see below) |
| `-h, --help`                | —       | Show help                                                              |

## Node.js API

### Load from a file or URL

```ts
import { generateFrom } from '@kartore/openapi-client-ts-generator/node';

const { types, client, query, index } = await generateFrom('./openapi.yaml');
// or
const { types, client, query, index } = await generateFrom(
  'https://example.com/openapi.json'
);
```

External `$ref`s are resolved automatically.

### From an object

```ts
import { generateFrom } from '@kartore/openapi-client-ts-generator/node';

const { types, client } = await generateFrom({
  openapi: '3.1.0',
  info: { title: 'My API', version: '1.0.0' },
  paths: { ... },
});
```

### Generate and write files to disk

```ts
import { generateAndWrite } from '@kartore/openapi-client-ts-generator/node';

await generateAndWrite('./openapi.yaml', {
  outDir: './src/api',
  tanstackQuery: 'react',
});
```

### With TanStack Query

```ts
import { generateFrom } from '@kartore/openapi-client-ts-generator/node';

const { types, client, query } = await generateFrom('./openapi.yaml', {
  tanstackQuery: 'react', // or 'svelte'
});
```

### Options

| Option                 | Type      | Default     | Description                                                            |
| ---------------------- | --------- | ----------- | ---------------------------------------------------------------------- |
| `tanstackQuery`        | `string`  | —           | TanStack Query framework: `'react'` or `'svelte'`                      |
| `typesImportPath`      | `string`  | `'./types'` | Import path used in `client.ts` to reference `types.ts`                |
| `throwOnHttpError`     | `boolean` | `true`      | Throw `HTTPError` when `response.ok` is false                          |
| `allowXTypescriptType` | `boolean` | `false`     | Enable `x-typescript-type` extension (trusted sources only, see below) |

### `x-typescript-type` extension (opt-in)

When the OpenAPI spec comes from a **trusted source**, you can use the `x-typescript-type` custom extension to override the generated type with an arbitrary TypeScript type expression:

```yaml
components:
  schemas:
    MaplibreStyleSpecification:
      type: object
      x-typescript-type: "import('maplibre-gl').StyleSpecification & { metadata: MaplibreMetadata }"
      properties:
        version:
          type: integer
```

```ts
export type MaplibreStyleSpecification =
  import('maplibre-gl').StyleSpecification & { metadata: MaplibreMetadata };
```

This also works on inline property schemas.

> **Security note:** The value of `x-typescript-type` is injected verbatim into the generated TypeScript file. Only enable this option when the spec comes from a source you control.

Enable via CLI:

```bash
npx openapi-gen ./openapi.yaml -o ./src/api --allow-x-typescript-type
```

Enable via API:

```ts
await generateFrom('./openapi.yaml', { allowXTypescriptType: true });
```

## Generated output

### `types.ts`

```ts
/* eslint-disable */
export type User = {
  id: string;
  name: string;
};
```

### `client.ts`

```ts
import type { User } from './types';

export function apiClient(baseUrl: string, clientOptions?: { ... }) {
  return {
    users: {
      id: (id: string) => ({
        key: ['users', id] as const,
        path: `/users/${id}`,
        get: (params?) => Promise<User>,
      }),
    },
  };
}
```

### `query.ts` (with `--tanstack-query react`)

```ts
export function queryClient(client: ReturnType<typeof apiClient>) {
  return {
    users: {
      id: (id: string) => ({
        get: (params?, options?) => UseQueryOptions<User>,
      }),
    },
  };
}
```
