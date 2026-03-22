import { describe, expect, test } from 'vitest';

import { schemaToTypeString, generateTypes } from '../src/schema';

describe('schemaToTypeString', () => {
  describe('primitive types', () => {
    test('string', () => {
      expect(schemaToTypeString({ type: 'string' })).toBe('string');
    });
    test('number', () => {
      expect(schemaToTypeString({ type: 'number' })).toBe('number');
    });
    test('integer maps to number', () => {
      expect(schemaToTypeString({ type: 'integer' })).toBe('number');
    });
    test('boolean', () => {
      expect(schemaToTypeString({ type: 'boolean' })).toBe('boolean');
    });
    test('null', () => {
      expect(schemaToTypeString({ type: 'null' })).toBe('null');
    });
    test('unknown type falls back to unknown', () => {
      expect(schemaToTypeString({ type: 'custom' })).toBe('unknown');
    });
    test('missing schema returns unknown', () => {
      expect(schemaToTypeString(null as never)).toBe('unknown');
    });
  });

  test('$ref extracts the last path segment as type name', () => {
    expect(schemaToTypeString({ $ref: '#/components/schemas/User' })).toBe(
      'User'
    );
    expect(
      schemaToTypeString({ $ref: '#/components/schemas/ApiResponse' })
    ).toBe('ApiResponse');
  });

  describe('array types', () => {
    test('array with typed items', () => {
      expect(
        schemaToTypeString({ type: 'array', items: { type: 'string' } })
      ).toBe('string[]');
    });
    test('array with $ref items', () => {
      expect(
        schemaToTypeString({
          type: 'array',
          items: { $ref: '#/components/schemas/User' },
        })
      ).toBe('User[]');
    });
    test('array without items defaults to unknown[]', () => {
      expect(schemaToTypeString({ type: 'array' })).toBe('unknown[]');
    });
  });

  describe('object types', () => {
    test('empty object returns Record<string, unknown>', () => {
      expect(schemaToTypeString({ type: 'object', properties: {} })).toBe(
        'Record<string, unknown>'
      );
    });
    test('object without properties key returns Record<string, unknown>', () => {
      expect(schemaToTypeString({ type: 'object' })).toBe(
        'Record<string, unknown>'
      );
    });
    test('required property has no ? modifier', () => {
      const result = schemaToTypeString({
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      });
      expect(result).toContain('id: string;');
      expect(result).not.toContain('id?');
    });
    test('optional property has ? modifier', () => {
      const result = schemaToTypeString({
        type: 'object',
        properties: { name: { type: 'string' } },
      });
      expect(result).toContain('name?: string;');
    });
    test('property with description adds JSDoc', () => {
      const result = schemaToTypeString({
        type: 'object',
        properties: { id: { type: 'string', description: 'The user ID' } },
        required: ['id'],
      });
      expect(result).toContain('@description The user ID');
    });
    test('property with example adds JSDoc @example', () => {
      const result = schemaToTypeString({
        type: 'object',
        properties: { age: { type: 'number', example: 42 } },
        required: ['age'],
      });
      expect(result).toContain('@example 42');
    });
  });

  describe('nullable (OpenAPI 3.0)', () => {
    test('nullable string becomes string | null', () => {
      expect(schemaToTypeString({ type: 'string', nullable: true })).toBe(
        'string | null'
      );
    });
    test('nullable $ref becomes RefType | null', () => {
      expect(
        schemaToTypeString({
          $ref: '#/components/schemas/User',
          nullable: true,
        })
      ).toBe('User | null');
    });
    test('nullable array becomes T[] | null', () => {
      expect(
        schemaToTypeString({
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        })
      ).toBe('string[] | null');
    });
    test('nullable object becomes {...} | null', () => {
      const result = schemaToTypeString({
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        nullable: true,
      });
      expect(result).toContain('| null');
    });
    test('nullable: false has no effect', () => {
      expect(schemaToTypeString({ type: 'string', nullable: false })).toBe(
        'string'
      );
    });
  });

  describe('composite types', () => {
    test('oneOf produces union type', () => {
      expect(
        schemaToTypeString({ oneOf: [{ type: 'string' }, { type: 'number' }] })
      ).toBe('string | number');
    });
    test('anyOf produces union type', () => {
      expect(
        schemaToTypeString({ anyOf: [{ type: 'string' }, { type: 'null' }] })
      ).toBe('string | null');
    });
    test('allOf produces intersection type', () => {
      expect(
        schemaToTypeString({ allOf: [{ type: 'string' }, { type: 'number' }] })
      ).toBe('string & number');
    });
    test('oneOf with $ref members', () => {
      expect(
        schemaToTypeString({
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
        })
      ).toBe('Cat | Dog');
    });
  });
});

describe('generateTypes', () => {
  test('generates export type declaration', () => {
    const result = generateTypes({
      User: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    });
    expect(result).toContain('export type User =');
    expect(result).toContain('id: string;');
  });

  test('uses description as JSDoc when present', () => {
    const result = generateTypes({
      User: { type: 'object', properties: {}, description: 'A platform user' },
    });
    expect(result).toContain('* A platform user');
  });

  test('falls back to schema name as JSDoc when no description', () => {
    const result = generateTypes({ User: { type: 'object', properties: {} } });
    expect(result).toContain('* User');
  });

  test('includes @example in JSDoc when schema has example', () => {
    const result = generateTypes({
      Status: { type: 'string', example: 'active' },
    });
    expect(result).toContain('@example "active"');
  });

  test('multiple schemas are joined with a blank line', () => {
    const result = generateTypes({
      User: { type: 'object', properties: {} },
      Post: { type: 'object', properties: {} },
    });
    expect(result).toContain('export type User');
    expect(result).toContain('export type Post');
    expect(result).toContain('\n\n');
  });

  test('empty schemas returns empty string', () => {
    expect(generateTypes({})).toBe('');
  });
});
