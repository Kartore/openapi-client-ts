# openapi-client-ts-generator

Generate TypeScript types and API client (and query client) from OpenAPI specifications.

## Usage

### Basic

```bash
npx openapi-gen <input-file> -o <output-dir>
```

### With options

for svelte-query client generation:

```bash
npx openapi-gen <input-file> -o <output-dir> --tnstack-query svelte
```

for react-query client generation:

```bash
npx openapi-gen <input-file> -o <output-dir> --tnstack-query react
```
