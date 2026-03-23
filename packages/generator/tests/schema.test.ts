import { describe, expect, test } from 'vite-plus/test';

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
      expect(
        schemaToTypeString({
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        })
      ).toMatchInlineSnapshot(`
      	"{
      	  id: string;
      	}"
      `);
    });
    test('optional property has ? modifier', () => {
      expect(
        schemaToTypeString({
          type: 'object',
          properties: { name: { type: 'string' } },
        })
      ).toMatchInlineSnapshot(`
      	"{
      	  name?: string;
      	}"
      `);
    });
    test('property with description adds JSDoc', () => {
      expect(
        schemaToTypeString({
          type: 'object',
          properties: { id: { type: 'string', description: 'The user ID' } },
          required: ['id'],
        })
      ).toMatchInlineSnapshot(`
      	"{
      	  /**
      	   * @description The user ID
      	   */
      	  id: string;
      	}"
      `);
    });
    test('property with example adds JSDoc @example', () => {
      expect(
        schemaToTypeString({
          type: 'object',
          properties: { age: { type: 'number', example: 42 } },
          required: ['age'],
        })
      ).toMatchInlineSnapshot(`
      	"{
      	  /**
      	   * @example 42
      	   */
      	  age: number;
      	}"
      `);
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
      expect(
        schemaToTypeString({
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
          nullable: true,
        })
      ).toMatchInlineSnapshot(`
      	"{
      	  id: string;
      	} | null"
      `);
    });
    test('nullable: false has no effect', () => {
      expect(schemaToTypeString({ type: 'string', nullable: false })).toBe(
        'string'
      );
    });
    test('nullable alone (no type) returns null', () => {
      expect(schemaToTypeString({ nullable: true })).toBe('null');
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
    test('anyOf with unknown sub-schema filters unknown from union', () => {
      expect(
        schemaToTypeString({
          anyOf: [
            { type: 'array', items: { type: 'number' } },
            { nullable: true },
            { nullable: true },
          ],
        })
      ).toBe('number[] | null');
    });
    test('anyOf where all parts are unknown stays unknown', () => {
      expect(schemaToTypeString({ anyOf: [{}, {}] })).toBe('unknown');
    });
  });
});

describe('generateTypes', () => {
  test('generates export type declaration', () => {
    expect(
      generateTypes({
        User: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      })
    ).toMatchInlineSnapshot(`
    	"/* eslint-disable */
    	/**
    	 * User
    	 */
    	export type User = {
    	  id: string;
    	};"
    `);
  });

  test('uses description as JSDoc when present', () => {
    expect(
      generateTypes({
        User: {
          type: 'object',
          properties: {},
          description: 'A platform user',
        },
      })
    ).toMatchInlineSnapshot(`
    	"/* eslint-disable */
    	/**
    	 * A platform user
    	 */
    	export type User = Record<string, unknown>;"
    `);
  });

  test('includes @example in JSDoc when schema has example', () => {
    expect(generateTypes({ Status: { type: 'string', example: 'active' } }))
      .toMatchInlineSnapshot(`
      	"/* eslint-disable */
      	/**
      	 * Status
      	 * @example "active"
      	 */
      	export type Status = string;"
      `);
  });

  test('multiple schemas are joined with a blank line', () => {
    expect(
      generateTypes({
        User: { type: 'object', properties: {} },
        Post: { type: 'object', properties: {} },
      })
    ).toMatchInlineSnapshot(`
    	"/* eslint-disable */
    	/**
    	 * User
    	 */
    	export type User = Record<string, unknown>;

    	/**
    	 * Post
    	 */
    	export type Post = Record<string, unknown>;"
    `);
  });

  test('empty schemas returns empty string', () => {
    expect(generateTypes({})).toBe('');
  });
});
