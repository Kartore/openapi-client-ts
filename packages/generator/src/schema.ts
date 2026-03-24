import type { OpenAPIV3_1 } from '@scalar/openapi-types';

/** Recursive schema type compatible with OpenAPIV3_1.SchemaObject and plain test objects */
export type SchemaLike = {
  $ref?: string;
  type?: string | string[];
  nullable?: boolean;
  description?: string;
  example?: unknown;
  properties?: Record<string, SchemaLike>;
  required?: string[];
  items?: SchemaLike;
  oneOf?: SchemaLike[];
  anyOf?: SchemaLike[];
  allOf?: SchemaLike[];
  enum?: unknown[];
  additionalProperties?: boolean | SchemaLike;
  minItems?: number;
  maxItems?: number;
  'x-typescript-type'?: string;
};

export interface SchemaGenerationOptions {
  /**
   * When true, `x-typescript-type` on a schema is used as-is as the TypeScript type expression.
   * Disabled by default because the value is injected verbatim into generated code —
   * only enable this when the OpenAPI spec comes from a trusted source.
   */
  allowXTypescriptType?: boolean;
}

export function collectRefTypes(
  schema: SchemaLike | boolean,
  collector: Set<string>
): void {
  if (!schema || typeof schema === 'boolean') return;
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop();
    if (name) collector.add(name);
    return;
  }
  schema.oneOf?.forEach((s) => collectRefTypes(s, collector));
  schema.anyOf?.forEach((s) => collectRefTypes(s, collector));
  schema.allOf?.forEach((s) => collectRefTypes(s, collector));
  if (schema.properties) {
    Object.values(schema.properties).forEach((s) =>
      collectRefTypes(s, collector)
    );
  }
  if (schema.items) collectRefTypes(schema.items, collector);
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties !== 'boolean'
  ) {
    collectRefTypes(schema.additionalProperties, collector);
  }
}

export function schemaToTypeString(
  schema: SchemaLike | boolean,
  inline = false,
  options: SchemaGenerationOptions = {}
): string {
  if (!schema) return 'unknown';
  if (schema === true) return 'any';
  if (typeof schema === 'boolean') return 'unknown';

  // Extract types early so we can detect 'null' in the array (OpenAPI 3.1 style)
  const rawTypes = Array.isArray(schema.type)
    ? schema.type
    : schema.type != null
      ? [schema.type]
      : [];
  const types = rawTypes.filter((t) => t !== 'null');

  const nullable = schema.nullable === true || rawTypes.includes('null');
  const withNull = (t: string) => (nullable ? `${t} | null` : t);

  // OpenAPI 3.0 pattern: { nullable: true } alone (no type/ref/composition) means "null"
  // Also handles OpenAPI 3.1 pattern: { type: 'null' }
  if (
    nullable &&
    !schema.$ref &&
    types.length === 0 &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf &&
    !schema.properties &&
    !schema.items &&
    !schema.enum &&
    !schema.additionalProperties
  ) {
    return 'null';
  }

  if (schema.$ref) {
    return withNull(schema.$ref.split('/').pop() ?? 'unknown');
  }

  // x-typescript-type override (opt-in only — value is injected verbatim)
  if (options.allowXTypescriptType && schema['x-typescript-type']) {
    return withNull(schema['x-typescript-type']);
  }

  // enum arrays → union literal type (handles z.enum() and z.literal())
  if (schema.enum && schema.enum.length > 0) {
    const literals = schema.enum
      .map((v) => (typeof v === 'string' ? `'${v}'` : JSON.stringify(v)))
      .join(' | ');
    return withNull(literals);
  }

  if (schema.oneOf) {
    const nonNullMembers = schema.oneOf.filter(
      (s) => !(typeof s === 'object' && !Array.isArray(s) && s.type === 'null')
    );
    const hasNullMember = nonNullMembers.length < schema.oneOf.length;
    const parts = nonNullMembers.map((s) =>
      schemaToTypeString(s, inline, options)
    );
    const known = parts.filter((p) => p !== 'unknown');
    const unique = [...new Set(known.length > 0 ? known : parts)];
    const result = unique.join(' | ');
    return hasNullMember || nullable ? `${result} | null` : result;
  }
  if (schema.anyOf) {
    const parts = schema.anyOf.map((s) =>
      schemaToTypeString(s, inline, options)
    );
    const known = parts.filter((p) => p !== 'unknown');
    const unique = [...new Set(known.length > 0 ? known : parts)];
    return withNull(unique.join(' | '));
  }
  if (schema.allOf) {
    // Extract { type: 'null' } members from allOf (produced by upgrade() from nullable+allOf)
    const nonNullMembers = schema.allOf.filter(
      (s) => !(typeof s === 'object' && !Array.isArray(s) && s.type === 'null')
    );
    const hasNullMember = nonNullMembers.length < schema.allOf.length;
    const allOfType = nonNullMembers
      .map((s) => schemaToTypeString(s, inline, options))
      .join(' & ');
    return hasNullMember || nullable ? `${allOfType} | null` : allOfType;
  }

  if (
    types.includes('object') ||
    schema.properties ||
    schema.additionalProperties
  ) {
    return withNull(objectSchemaToTypeString(schema, inline, options));
  }

  if (types.includes('array')) {
    const itemType = schema.items
      ? schemaToTypeString(schema.items, inline, options)
      : 'unknown';
    if (
      schema.minItems !== undefined &&
      schema.minItems === schema.maxItems &&
      schema.minItems > 0
    ) {
      const elements = Array(schema.minItems).fill(itemType).join(', ');
      return withNull(`[${elements}]`);
    }
    return withNull(`${itemType}[]`);
  }

  // Empty schema (no type constraints, no structure) → any (represents z.any())
  if (types.length === 0) {
    return withNull('any');
  }

  const tsTypes = types
    .map((t) => {
      switch (t) {
        case 'string':
          return 'string';
        case 'number':
        case 'integer':
          return 'number';
        case 'boolean':
          return 'boolean';
        case 'null':
          return 'null';
        default:
          return 'unknown';
      }
    })
    .filter(Boolean);

  const knownTypes = tsTypes.filter((t) => t !== 'unknown');
  const resolved = knownTypes.length > 0 ? knownTypes : tsTypes;
  return withNull(resolved.length > 0 ? resolved.join(' | ') : 'unknown');
}

/** additionalProperties が true または空スキーマ {} かどうか判定する */
function isAnyAdditionalProperties(
  ap: boolean | SchemaLike | undefined
): boolean {
  if (ap === true) return true;
  if (ap && typeof ap === 'object' && Object.keys(ap).length === 0) return true;
  return false;
}

function objectSchemaToTypeString(
  schema: SchemaLike,
  inline = false,
  options: SchemaGenerationOptions = {}
): string {
  const properties = schema.properties ?? {};
  const required = new Set<string>(schema.required ?? []);
  const hasProperties = Object.keys(properties).length > 0;
  const anyAp = isAnyAdditionalProperties(schema.additionalProperties);

  if (!hasProperties) {
    if (anyAp) {
      return 'any';
    }
    if (
      schema.additionalProperties &&
      typeof schema.additionalProperties !== 'boolean'
    ) {
      const valueType = schemaToTypeString(
        schema.additionalProperties,
        inline,
        options
      );
      return `Record<string, ${valueType}>`;
    }
    return 'Record<string, unknown>';
  }

  if (inline) {
    const fields = Object.entries(properties).map(([name, propSchema]) => {
      const optional = required.has(name) ? '' : '?';
      const jsdoc = buildPropertyJsdoc(propSchema, true);
      return `${jsdoc}${name}${optional}: ${schemaToTypeString(propSchema, true, options)}`;
    });
    if (anyAp) fields.push('[key: string]: any');
    return `{ ${fields.join('; ')} }`;
  }

  const lines = Object.entries(properties).map(([name, propSchema]) => {
    const isRequired = required.has(name);
    const propType = schemaToTypeString(propSchema, false, options);
    const jsdoc = buildPropertyJsdoc(propSchema);
    const optional = isRequired ? '' : '?';
    return `${jsdoc}  ${name}${optional}: ${propType};`;
  });
  if (anyAp) lines.push('  [key: string]: any;');

  return `{\n${lines.join('\n')}\n}`;
}

function buildPropertyJsdoc(schema: SchemaLike, inline = false): string {
  const parts: string[] = [];
  if (schema.description) parts.push(`@description ${schema.description}`);
  if (schema.example !== undefined)
    parts.push(`@example ${JSON.stringify(schema.example)}`);
  if (parts.length === 0) return '';
  if (inline) return `/** ${parts.join(' ')} */ `;
  const lines = parts.map((p) => `   * ${p}`);
  return `  /**\n${lines.join('\n')}\n   */\n`;
}

function generateSchemaType(
  name: string,
  schema: OpenAPIV3_1.SchemaObject,
  options: SchemaGenerationOptions = {}
): string {
  const s = schema as SchemaLike;
  const jsdocLines = ['/**'];
  jsdocLines.push(s.description ? ` * ${s.description}` : ` * ${name}`);
  if (s.example !== undefined) {
    jsdocLines.push(` * @example ${JSON.stringify(s.example)}`);
  }
  jsdocLines.push(' */');
  const typeExpr =
    options.allowXTypescriptType && s['x-typescript-type']
      ? s['x-typescript-type']
      : schemaToTypeString(s, false, options);
  return `${jsdocLines.join('\n')}\nexport type ${name} = ${typeExpr};`;
}

const FILE_HEADER = '/* eslint-disable */\n/* prettier-ignore-start */';

export function generateTypes(
  schemas: Record<string, OpenAPIV3_1.SchemaObject>,
  options: SchemaGenerationOptions = {}
): string {
  const body = Object.entries(schemas)
    .map(([name, schema]) => generateSchemaType(name, schema, options))
    .join('\n\n');
  return body ? `${FILE_HEADER}\n${body}` : '';
}
