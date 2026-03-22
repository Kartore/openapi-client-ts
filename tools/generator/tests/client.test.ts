import { describe, expect, test } from 'vitest';

import {
  segmentsToTemplateParts,
  buildKeyExpression,
  buildPathValue,
  buildUrlExpression,
  generateClient,
} from '../src/client';

describe('segmentsToTemplateParts', () => {
  test('passes through static segments unchanged', () => {
    expect(segmentsToTemplateParts(['users'])).toEqual(['users']);
    expect(segmentsToTemplateParts(['users', 'me'])).toEqual(['users', 'me']);
  });

  test('converts {param} to ${param}', () => {
    expect(segmentsToTemplateParts(['{id}'])).toEqual(['${id}']);
  });

  test('handles mixed static and dynamic segments', () => {
    expect(
      segmentsToTemplateParts(['users', '{id}', 'posts', '{postId}'])
    ).toEqual(['users', '${id}', 'posts', '${postId}']);
  });
});

describe('buildKeyExpression', () => {
  test('single static item', () => {
    expect(buildKeyExpression(["'users'"])).toBe("['users'] as const");
  });

  test('static and dynamic items', () => {
    expect(buildKeyExpression(["'users'", 'id'])).toBe(
      "['users', id] as const"
    );
  });

  test('deeply nested key', () => {
    expect(buildKeyExpression(["'org'", 'orgId', "'members'"])).toBe(
      "['org', orgId, 'members'] as const"
    );
  });

  test('empty array', () => {
    expect(buildKeyExpression([])).toBe('[] as const');
  });
});

describe('buildPathValue', () => {
  test('static path returns string literal with as const', () => {
    expect(buildPathValue(['users'])).toBe("'/users' as const");
  });

  test('nested static path', () => {
    expect(buildPathValue(['users', 'me'])).toBe("'/users/me' as const");
  });

  test('dynamic segment returns template literal', () => {
    expect(buildPathValue(['users', '{id}'])).toBe('`/users/${id}`');
  });

  test('dynamic segment in the middle', () => {
    expect(buildPathValue(['users', '{id}', 'posts'])).toBe(
      '`/users/${id}/posts`'
    );
  });

  test('multiple dynamic segments', () => {
    expect(buildPathValue(['org', '{orgId}', 'members', '{memberId}'])).toBe(
      '`/org/${orgId}/members/${memberId}`'
    );
  });
});

describe('buildUrlExpression', () => {
  test('static path', () => {
    expect(buildUrlExpression(['users'])).toBe('`${baseUrl}/users`');
  });

  test('dynamic path', () => {
    expect(buildUrlExpression(['users', '{id}'])).toBe(
      '`${baseUrl}/users/${id}`'
    );
  });

  test('multiple dynamic segments', () => {
    expect(buildUrlExpression(['users', '{id}', 'posts', '{postId}'])).toBe(
      '`${baseUrl}/users/${id}/posts/${postId}`'
    );
  });
});

describe('generateClient', () => {
  test('empty paths produces minimal apiClient', () => {
    expect(generateClient({})).toBe(
      "export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {\n  return {};\n}"
    );
  });

  test('exports apiClient function', () => {
    const result = generateClient({ '/users': { get: { responses: {} } } });
    expect(result).toContain('export function apiClient(baseUrl: string,');
    expect(result).toContain(
      'const _fetch = clientOptions?.fetch ?? globalThis.fetch'
    );
    expect(result).toContain('const _baseInit = clientOptions?.init');
  });

  describe('static segments', () => {
    test('becomes an object property with key and path', () => {
      const result = generateClient({ '/users': { get: { responses: {} } } });
      expect(result).toContain('users: {');
      expect(result).toContain("key: ['users'] as const");
      expect(result).toContain("path: '/users' as const");
    });

    test('segment with hyphens is quoted as property key', () => {
      const result = generateClient({
        '/auth/verify-email': { post: { responses: {} } },
      });
      expect(result).toContain("'verify-email': {");
      expect(result).toContain("key: ['auth', 'verify-email'] as const");
    });

    test('segment starting with underscore or dollar is not quoted', () => {
      const result = generateClient({
        '/api/_public': { get: { responses: {} } },
      });
      expect(result).toContain('_public: {');
    });
  });

  describe('dynamic segments', () => {
    test('becomes a function that returns an object with key and path', () => {
      const result = generateClient({
        '/users/{id}': {
          get: {
            parameters: [
              { in: 'path', name: 'id', schema: { type: 'string' } },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain('id: (id: string) => ({');
      expect(result).toContain("key: ['users', id] as const");
      expect(result).toContain('path: `/users/${id}`');
    });

    test('uses schema type for param type', () => {
      const result = generateClient({
        '/items/{code}': {
          get: {
            parameters: [
              { in: 'path', name: 'code', schema: { type: 'integer' } },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain('code: (code: number) => ({');
    });

    test('defaults to string when no param schema', () => {
      const result = generateClient({
        '/users/{id}': { get: { responses: {} } },
      });
      expect(result).toContain('id: (id: string) => ({');
    });
  });

  describe('HTTP methods', () => {
    test('GET generates typed fetch call with @method JSDoc', () => {
      const result = generateClient({
        '/users/{id}': {
          get: {
            parameters: [
              { in: 'path', name: 'id', schema: { type: 'string' } },
            ],
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      });
      expect(result).toContain('* @method GET');
      expect(result).toContain('get: (params?: {');
      expect(result).toContain("init?: Omit<RequestInit, 'headers'>");
      expect(result).toContain('): Promise<User> => {');
      expect(result).toContain('_fetch(url, { ..._baseInit, ...params?.init');
      expect(result).toContain("method: 'GET'");
      expect(result).toContain('.then((r) => r.json()) as Promise<User>');
    });

    test('void return type when no success response', () => {
      const result = generateClient({ '/ping': { get: { responses: {} } } });
      expect(result).toContain('get: (params?: {');
      expect(result).toContain('): Promise<void> => {');
      expect(result).toContain('.then(() => undefined)');
    });

    test('POST with request body generates params with body field', () => {
      const result = generateClient({
        '/users': {
          post: {
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
            responses: {},
          },
        },
      });
      expect(result).toContain('post: (params:');
      expect(result).toContain('body:');
      expect(result).toContain("method: 'POST'");
      expect(result).toContain('JSON.stringify(params.body)');
    });
  });

  describe('query parameters', () => {
    test('optional query param generates URLSearchParams block and ? type', () => {
      const result = generateClient({
        '/users': {
          get: {
            parameters: [
              {
                in: 'query',
                name: 'page',
                schema: { type: 'integer' },
                required: false,
              },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain('get: (params?:');
      expect(result).toContain('page?: number;');
      expect(result).toContain("init?: Omit<RequestInit, 'headers'>");
      expect(result).toContain('URLSearchParams');
      expect(result).toContain("searchParams.set('page'");
    });

    test('required query param generates no ? modifier', () => {
      const result = generateClient({
        '/users': {
          get: {
            parameters: [
              {
                in: 'query',
                name: 'q',
                schema: { type: 'string' },
                required: true,
              },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain('q: string;');
      expect(result).not.toContain('q?: string;');
    });
  });

  describe('node with both operations and children', () => {
    test('generates get on users and id child accessor', () => {
      const result = generateClient({
        '/users': { get: { responses: {} } },
        '/users/{id}': {
          get: {
            parameters: [
              { in: 'path', name: 'id', schema: { type: 'string' } },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain('users: {');
      expect(result).toContain('get: (params?: {');
      expect(result).toContain('id: (id: string) => ({');
    });
  });

  describe('deep nesting', () => {
    test('three-level path with two dynamic segments', () => {
      const result = generateClient({
        '/orgs/{orgId}/members/{memberId}': {
          get: {
            parameters: [
              { in: 'path', name: 'orgId', schema: { type: 'string' } },
              { in: 'path', name: 'memberId', schema: { type: 'string' } },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain('orgId: (orgId: string) => ({');
      expect(result).toContain('memberId: (memberId: string) => ({');
      expect(result).toContain(
        '`${baseUrl}/orgs/${orgId}/members/${memberId}`'
      );
    });
  });
});
