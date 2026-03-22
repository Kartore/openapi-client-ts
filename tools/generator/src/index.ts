import { validate, type AnyObject } from '@scalar/openapi-parser';

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

export async function generateFromObject(
  spec: AnyObject | string
): Promise<GenerateResult> {
  const { valid, specification } = await validate(spec, {});
  const version = specification?.openapi as string | undefined;
  if (!valid) {
    throw new Error('Invalid OpenAPI specification');
  }
  if (!specification) {
    throw new Error('No specification found');
  }
  if (!version || (!version.startsWith('3.0.') && version !== '3.1.0')) {
    throw new Error('No specification found or unsupported OpenAPI version');
  }

  const schemas = (specification.components?.schemas ?? {}) as Record<
    string,
    AnyObject
  >;
  const paths = (specification.paths ?? {}) as Record<string, AnyObject>;

  return {
    types: generateTypes(schemas),
    client: generateClient(paths),
  };
}
