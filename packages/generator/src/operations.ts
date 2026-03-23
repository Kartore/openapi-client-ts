import { collectRefTypes, schemaToTypeString, type SchemaLike } from './schema';

/** Subset of OpenAPIV3.ParameterObject compatible with both library types and plain test objects */
export type ParameterLike = {
  name?: string;
  in?: string;
  required?: boolean;
  schema?: { $ref?: string; type?: string | string[]; [key: string]: any };
};

/** Subset of OpenAPIV3.OperationObject compatible with both library types and plain test objects */
export type OperationLike = {
  summary?: string;
  parameters?: ParameterLike[];
  requestBody?: {
    content?: Record<string, { schema?: { [key: string]: any } }>;
  };

  responses?: Record<
    string,
    { content?: Record<string, { schema?: { [key: string]: any } }> }
  >;
};

export function collectOperationRefTypes(
  operation: OperationLike,
  collector: Set<string>
): void {
  const successResponse =
    operation.responses?.['200'] ?? operation.responses?.['201'];
  const responseSchema = successResponse?.content?.['application/json']?.schema;
  if (responseSchema) collectRefTypes(responseSchema as SchemaLike, collector);
  const bodySchema =
    operation.requestBody?.content?.['application/json']?.schema;
  if (bodySchema) collectRefTypes(bodySchema as SchemaLike, collector);
  for (const param of operation.parameters ?? []) {
    if (param.in === 'query' && param.schema) {
      collectRefTypes(param.schema as SchemaLike, collector);
    }
  }
}

export function getResponseType(operation: OperationLike): string {
  const successResponse =
    operation.responses?.['200'] ?? operation.responses?.['201'];
  if (!successResponse) return 'void';
  const jsonContent = successResponse.content?.['application/json'];
  if (!jsonContent?.schema) return 'void';
  return schemaToTypeString(jsonContent.schema, true);
}

export function getQueryParameters(operation: OperationLike): ParameterLike[] {
  return (operation.parameters ?? []).filter((p) => p.in === 'query');
}

export function getRequestBodyType(operation: OperationLike): string | null {
  const bodySchema =
    operation.requestBody?.content?.['application/json']?.schema;
  return bodySchema ? schemaToTypeString(bodySchema, true) : null;
}
