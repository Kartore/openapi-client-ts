import { upgrade, validate } from '@scalar/openapi-parser';
import type { OpenAPI, OpenAPIV3_1 } from '@scalar/openapi-types';

import { generateClient } from './client';
import { generateTypes } from './schema';

export { generateTypes } from './schema';
export { generateClient } from './client';

export interface GenerateResult {
  /** TypeScript type definitions generated from components.schemas */
  types: string;
  /** TypeScript apiClient factory function generated from paths */
  client: string;
}

function isSupportedVersion(spec: OpenAPI.Document): boolean {
  const v = spec.openapi;
  return (
    v === '3.0.0' ||
    v === '3.0.1' ||
    v === '3.0.2' ||
    v === '3.0.3' ||
    v === '3.0.4' ||
    v === '3.1.0' ||
    v === '3.1.1' ||
    v === '3.1.2'
  );
}

export async function generateFromObject(
  spec: Record<string, unknown> | string
): Promise<GenerateResult> {
  const { valid, specification } = await validate(spec, {});
  if (!specification || !isSupportedVersion(specification)) {
    throw new Error('No specification found or unsupported OpenAPI version');
  }
  if (!valid) {
    throw new Error('Invalid OpenAPI specification');
  }

  // Normalize to OpenAPI 3.1 so downstream functions work with a single concrete type
  const { specification: spec31 } = upgrade(spec as Record<string, unknown>);
  const schemas: Record<string, OpenAPIV3_1.SchemaObject> =
    spec31.components?.schemas ?? {};
  const paths: OpenAPIV3_1.PathsObject = spec31.paths ?? {};
  return {
    types: generateTypes(schemas),
    client: generateClient(paths),
  };
}
