import type { AnyObject } from '@scalar/openapi-parser';

export function schemaToTypeString(schema: AnyObject, inline = false): string {
  if (!schema) return 'unknown';

  const nullable = schema.nullable === true;
  const withNull = (t: string) => (nullable ? `${t} | null` : t);

  if (schema.$ref) {
    return withNull(String(schema.$ref).split('/').pop() ?? 'unknown');
  }

  if (schema.oneOf) {
    return withNull(
      (schema.oneOf as AnyObject[])
        .map((s) => schemaToTypeString(s, inline))
        .join(' | ')
    );
  }
  if (schema.anyOf) {
    return withNull(
      (schema.anyOf as AnyObject[])
        .map((s) => schemaToTypeString(s, inline))
        .join(' | ')
    );
  }
  if (schema.allOf) {
    return withNull(
      (schema.allOf as AnyObject[])
        .map((s) => schemaToTypeString(s, inline))
        .join(' & ')
    );
  }

  const types: string[] = Array.isArray(schema.type)
    ? schema.type
    : [schema.type];

  if (types.includes('object') || schema.properties) {
    return withNull(objectSchemaToTypeString(schema, inline));
  }

  if (types.includes('array')) {
    const itemType = schema.items
      ? schemaToTypeString(schema.items as AnyObject, inline)
      : 'unknown';
    return withNull(`${itemType}[]`);
  }

  const tsTypes = types
    .map((t: string) => {
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

  return withNull(tsTypes.length > 0 ? tsTypes.join(' | ') : 'unknown');
}

function objectSchemaToTypeString(schema: AnyObject, inline = false): string {
  const properties = (schema.properties ?? {}) as Record<string, AnyObject>;
  const required = new Set<string>((schema.required as string[]) ?? []);

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

function buildPropertyJsdoc(schema: AnyObject, inline = false): string {
  const parts: string[] = [];
  if (schema.description) parts.push(`@description ${schema.description}`);
  if (schema.example !== undefined)
    parts.push(`@example ${JSON.stringify(schema.example)}`);
  if (parts.length === 0) return '';
  if (inline) return `/** ${parts.join(' ')} */ `;
  const lines = parts.map((p) => `   * ${p}`);
  return `  /**\n${lines.join('\n')}\n   */\n`;
}

function generateSchemaType(name: string, schema: AnyObject): string {
  const jsdocLines = ['/**'];
  jsdocLines.push(
    schema.description ? ` * ${schema.description}` : ` * ${name}`
  );
  if (schema.example !== undefined) {
    jsdocLines.push(` * @example ${JSON.stringify(schema.example)}`);
  }
  jsdocLines.push(' */');
  return `${jsdocLines.join('\n')}\nexport type ${name} = ${schemaToTypeString(schema)};`;
}

export function generateTypes(schemas: Record<string, AnyObject>): string {
  return Object.entries(schemas)
    .map(([name, schema]) => generateSchemaType(name, schema))
    .join('\n\n');
}
