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

import { generateFromObject } from './index.js';

const HELP = `\
Usage: openapi-gen <input> [options]

  <input>   URL or local file path to an OpenAPI 3.1 spec (JSON or YAML)

Options:
  -o, --output <dir>       Output directory (default: ".")
  --types <filename>       Types output filename (default: "types.ts")
  --client <filename>      Client output filename (default: "client.ts")
  -h, --help               Show this help message
`;

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o', default: '.' },
    types: { type: 'string', default: 'types.ts' },
    client: { type: 'string', default: 'client.ts' },
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
const typesFile = resolve(outputDir, values.types!);
const clientFile = resolve(outputDir, values.client!);

try {
  const spec = await bundle(input, {
    treeShake: true,
    plugins: [fetchUrls(), readFiles(), parseJson(), parseYaml()],
  });

  const { types, client } = await generateFromObject(
    spec as Record<string, unknown>
  );

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(typesFile, types, 'utf8'),
    writeFile(clientFile, client, 'utf8'),
  ]);

  console.info(`types  → ${typesFile}`);
  console.info(`client → ${clientFile}`);
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
