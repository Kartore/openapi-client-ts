import { validate, type AnyObject } from '@scalar/openapi-parser';

async function generateFromObject(spec: AnyObject | string) {
  const { valid } = await validate(spec, {});
  if (!valid) {
    throw new Error('Invalid OpenAPI specification');
    return;
  }
}

export { generateFromObject };
