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
