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

This generates two files in the output directory:

- `types.ts` — TypeScript types from `components.schemas`
- `client.ts` — Typed `apiClient` factory function from `paths`

### TanStack Query helpers

```bash
# React Query
npx openapi-gen ./openapi.yaml -o ./src/api --tanstack-query react

# Svelte Query
npx openapi-gen ./openapi.yaml -o ./src/api --tanstack-query svelte
```

Adds a `query.ts` file with `queryClient` helpers wrapping the API client.

### All options

| Option                    | Default     | Description                     |
| ------------------------- | ----------- | ------------------------------- |
| `-o, --output <dir>`      | `.`         | Output directory                |
| `--types <filename>`      | `types.ts`  | Types output filename           |
| `--client <filename>`     | `client.ts` | Client output filename          |
| `--query <filename>`      | `query.ts`  | TanStack Query helpers filename |
| `--tanstack-query <name>` | —           | `react` or `svelte`             |

## Node.js API

### Load from a file or URL

```ts
import { generateFrom } from '@kartore/openapi-client-ts-generator/node';

const { types, client, query } = await generateFrom('./openapi.yaml');
// or
const { types, client, query } = await generateFrom(
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

### With TanStack Query

```ts
import { generateFrom } from '@kartore/openapi-client-ts-generator/node';

const { types, client, query } = await generateFrom('./openapi.yaml', {
  tanstackQuery: 'react', // or 'svelte'
});
```

## Generated output

### `types.ts`

```ts
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
        get: (params?) => Promise<User>;
        // ...
      }),
    },
  };
}
```

### `query.ts` (with `--tanstack-query react`)

```ts
export function queryClient(client: ApiClient) {
  return {
    users: {
      id: (id: string) => ({
        get: (params?, options?) => UseQueryOptions<User>;
      }),
    },
  };
}
```
