import type { AnyObject } from '@scalar/openapi-parser';

import { schemaToTypeString } from './schema';

export function getResponseType(operation: AnyObject): string {
  const successResponse =
    (operation.responses as AnyObject)?.['200'] ??
    (operation.responses as AnyObject)?.['201'];
  if (!successResponse) return 'void';
  const jsonContent = (successResponse as AnyObject).content?.[
    'application/json'
  ];
  if (!jsonContent?.schema) return 'void';
  return schemaToTypeString(jsonContent.schema as AnyObject, true);
}

export function getQueryParameters(operation: AnyObject): AnyObject[] {
  return ((operation.parameters as AnyObject[]) ?? []).filter(
    (p) => p.in === 'query'
  );
}

export function getRequestBodyType(operation: AnyObject): string | null {
  const bodySchema = (operation.requestBody as AnyObject)?.content?.[
    'application/json'
  ]?.schema;
  return bodySchema ? schemaToTypeString(bodySchema as AnyObject, true) : null;
}
