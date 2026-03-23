import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { bundle } from '@scalar/json-magic/bundle';
import {
  fetchUrls,
  parseJson,
  parseYaml,
} from '@scalar/json-magic/bundle/plugins/browser';
import { readFiles } from '@scalar/json-magic/bundle/plugins/node';

import {
  generateFromObject,
  type GenerateOptions,
  type GenerateResult,
} from './index.js';

export interface WriteOptions {
  /** Output directory (default: `'.'`) */
  outDir?: string;
}

/**
 * Generate TypeScript types and API client from a local file path, URL,
 * or already-parsed object.
 *
 * - File path: `'/path/to/openapi.yaml'`
 * - URL: `'https://example.com/openapi.json'`
 * - Object: `{ openapi: '3.1.0', ... }`
 *
 * For inline JSON/YAML strings, use `generateFromObject` directly.
 */
export async function generateFrom(
  input: string | Record<string, unknown>,
  options?: GenerateOptions
): Promise<GenerateResult> {
  if (typeof input !== 'string') {
    return generateFromObject(input, options);
  }
  const spec = await bundle(input, {
    treeShake: true,
    plugins: [fetchUrls(), readFiles(), parseJson(), parseYaml()],
  });
  return generateFromObject(spec as Record<string, unknown>, options);
}

/**
 * Generate and write output files to disk.
 *
 * Writes `client.ts` and `index.ts` always; `types.ts` when schemas exist;
 * `query.ts` when a TanStack Query framework is specified.
 *
 * @returns Resolved paths of the written files.
 */
export async function generateAndWrite(
  input: string | Record<string, unknown>,
  options?: GenerateOptions & WriteOptions
): Promise<{ types?: string; client: string; query?: string; index: string }> {
  const { outDir, ...generateOptions } = options ?? {};
  const outputDir = resolve(outDir ?? '.');

  const { types, client, query, index } = await generateFrom(
    input,
    generateOptions
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

  return {
    ...(types ? { types: resolve(outputDir, 'types.ts') } : {}),
    client: resolve(outputDir, 'client.ts'),
    ...(query !== null ? { query: resolve(outputDir, 'query.ts') } : {}),
    index: resolve(outputDir, 'index.ts'),
  };
}
