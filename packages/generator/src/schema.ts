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
};

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
}

export function schemaToTypeString(
  schema: SchemaLike | boolean,
  inline = false
): string {
  if (!schema || typeof schema === 'boolean') return 'unknown';

  const nullable = schema.nullable === true;
  const withNull = (t: string) => (nullable ? `${t} | null` : t);

  // OpenAPI 3.0 pattern: { nullable: true } alone (no type/ref/composition) means "null"
  if (
    nullable &&
    !schema.$ref &&
    !schema.type &&
    !schema.oneOf &&
    !schema.anyOf &&
    !schema.allOf &&
    !schema.properties &&
    !schema.items
  ) {
    return 'null';
  }

  if (schema.$ref) {
    return withNull(schema.$ref.split('/').pop() ?? 'unknown');
  }

  if (schema.oneOf) {
    const parts = schema.oneOf.map((s) => schemaToTypeString(s, inline));
    const known = parts.filter((p) => p !== 'unknown');
    const unique = [...new Set(known.length > 0 ? known : parts)];
    return withNull(unique.join(' | '));
  }
  if (schema.anyOf) {
    const parts = schema.anyOf.map((s) => schemaToTypeString(s, inline));
    const known = parts.filter((p) => p !== 'unknown');
    const unique = [...new Set(known.length > 0 ? known : parts)];
    return withNull(unique.join(' | '));
  }
  if (schema.allOf) {
    return withNull(
      schema.allOf.map((s) => schemaToTypeString(s, inline)).join(' & ')
    );
  }

  const types = Array.isArray(schema.type)
    ? schema.type
    : schema.type != null
      ? [schema.type]
      : [];

  if (types.includes('object') || schema.properties) {
    return withNull(objectSchemaToTypeString(schema, inline));
  }

  if (types.includes('array')) {
    const itemType = schema.items
      ? schemaToTypeString(schema.items, inline)
      : 'unknown';
    return withNull(`${itemType}[]`);
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

function objectSchemaToTypeString(schema: SchemaLike, inline = false): string {
  const properties = schema.properties ?? {};
  const required = new Set<string>(schema.required ?? []);

  if (Object.keys(properties).length === 0) {
    return 'Record<string, unknown>';
  }

  if (inline) {
    const fields = Object.entries(properties).map(([name, propSchema]) => {
      const optional = required.has(name) ? '' : '?';
      const jsdoc = buildPropertyJsdoc(propSchema, true);
      return `${jsdoc}${name}${optional}: ${schemaToTypeString(propSchema, true)}`;
    });
    return `{ ${fields.join('; ')} }`;
  }

  const lines = Object.entries(properties).map(([name, propSchema]) => {
    const isRequired = required.has(name);
    const propType = schemaToTypeString(propSchema, false);
    const jsdoc = buildPropertyJsdoc(propSchema);
    const optional = isRequired ? '' : '?';
    return `${jsdoc}  ${name}${optional}: ${propType};`;
  });

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
  schema: OpenAPIV3_1.SchemaObject
): string {
  const s = schema as SchemaLike;
  const jsdocLines = ['/**'];
  jsdocLines.push(s.description ? ` * ${s.description}` : ` * ${name}`);
  if (s.example !== undefined) {
    jsdocLines.push(` * @example ${JSON.stringify(s.example)}`);
  }
  jsdocLines.push(' */');
  return `${jsdocLines.join('\n')}\nexport type ${name} = ${schemaToTypeString(s)};`;
}

export function generateTypes(
  schemas: Record<string, OpenAPIV3_1.SchemaObject>
): string {
  return Object.entries(schemas)
    .map(([name, schema]) => generateSchemaType(name, schema))
    .join('\n\n');
}
