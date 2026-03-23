#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { bundle } from '@scalar/json-magic/bundle';
import {
  fetchUrls,
  parseJson,
  parseYaml,
} from '@scalar/json-magic/bundle/plugins/browser';
import { readFiles } from '@scalar/json-magic/bundle/plugins/node';

import { type QueryFramework, generateFromObject } from './index.js';

const HELP = `\
Usage: openapi-gen <input> [options]

  <input>   URL or local file path to an OpenAPI 3.1 spec (JSON or YAML)

Options:
  -o, --output <dir>        Output directory (default: ".")
  --tanstack-query <name>   TanStack Query framework: react or svelte
  --no-throw-on-http-error  Do not throw HTTPError on non-ok responses
  -h, --help                Show this help message
`;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o', default: '.' },
    'tanstack-query': { type: 'string' },
    'no-throw-on-http-error': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  process.stdout.write(HELP);
  process.exit(positionals.length === 0 && !values.help ? 1 : 0);
}

const input = positionals[0];
const outputDir = resolve(values.output!);

try {
  const spec = await bundle(input, {
    treeShake: true,
    plugins: [fetchUrls(), readFiles(), parseJson(), parseYaml()],
  });

  const { types, client, query, index } = await generateFromObject(
    spec as Record<string, unknown>,
    {
      tanstackQuery: values['tanstack-query'] as QueryFramework | undefined,
      throwOnHttpError: !values['no-throw-on-http-error'],
    }
  );

  await mkdir(outputDir, { recursive: true });

  const writes: Promise<void>[] = [
    writeFile(resolve(outputDir, 'client.ts'), client, 'utf8'),
    writeFile(resolve(outputDir, 'index.ts'), index, 'utf8'),
  ];
  if (types)
    writes.push(writeFile(resolve(outputDir, 'types.ts'), types, 'utf8'));
  if (query !== null)
    writes.push(writeFile(resolve(outputDir, 'query.ts'), query, 'utf8'));
  await Promise.all(writes);

  if (types) console.info(`types  → ${resolve(outputDir, 'types.ts')}`);
  console.info(`client → ${resolve(outputDir, 'client.ts')}`);
  if (query !== null)
    console.info(`query  → ${resolve(outputDir, 'query.ts')}`);
  console.info(`index  → ${resolve(outputDir, 'index.ts')}`);
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
