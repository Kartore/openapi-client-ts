import { describe, expect, test } from 'vitest';

import {
  getResponseType,
  getQueryParameters,
  getRequestBodyType,
} from '../src/operations';

describe('getResponseType', () => {
  test('returns TypeScript type from 200 response schema', () => {
    const op = {
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
    };
    expect(getResponseType(op)).toBe('User');
  });

  test('returns type from 201 when 200 is absent', () => {
    const op = {
      responses: {
        '201': {
          content: { 'application/json': { schema: { type: 'string' } } },
        },
      },
    };
    expect(getResponseType(op)).toBe('string');
  });

  test('prefers 200 over 201 when both present', () => {
    const op = {
      responses: {
        '200': {
          content: { 'application/json': { schema: { type: 'string' } } },
        },
        '201': {
          content: { 'application/json': { schema: { type: 'number' } } },
        },
      },
    };
    expect(getResponseType(op)).toBe('string');
  });

  test('returns void when no success response exists', () => {
    expect(getResponseType({ responses: {} })).toBe('void');
    expect(getResponseType({ responses: { '400': {} } })).toBe('void');
  });

  test('returns void when response has no JSON content', () => {
    expect(getResponseType({ responses: { '200': { content: {} } } })).toBe(
      'void'
    );
    expect(getResponseType({ responses: { '200': {} } })).toBe('void');
  });

  test('returns void when operation has no responses key', () => {
    expect(getResponseType({})).toBe('void');
  });
});

describe('getQueryParameters', () => {
  test('returns only parameters with in === query', () => {
    const op = {
      parameters: [
        { in: 'query', name: 'page' },
        { in: 'path', name: 'id' },
        { in: 'header', name: 'Authorization' },
        { in: 'query', name: 'limit' },
      ],
    };
    const result = getQueryParameters(op);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('page');
    expect(result[1].name).toBe('limit');
  });

  test('returns empty array when parameters is absent', () => {
    expect(getQueryParameters({})).toHaveLength(0);
  });

  test('returns empty array when no query parameters exist', () => {
    const op = { parameters: [{ in: 'path', name: 'id' }] };
    expect(getQueryParameters(op)).toHaveLength(0);
  });
});

describe('getRequestBodyType', () => {
  test('returns null when no requestBody', () => {
    expect(getRequestBodyType({})).toBeNull();
  });

  test('returns TypeScript type for JSON body schema', () => {
    const op = {
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateUser' },
          },
        },
      },
    };
    expect(getRequestBodyType(op)).toBe('CreateUser');
  });

  test('returns inline type for non-ref body schema', () => {
    const op = {
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
    };
    const result = getRequestBodyType(op);
    expect(result).toContain('name: string');
  });

  test('returns null when body has no JSON content', () => {
    const op = { requestBody: { content: { 'multipart/form-data': {} } } };
    expect(getRequestBodyType(op)).toBeNull();
  });
});
