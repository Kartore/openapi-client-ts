import { describe, expect, test } from 'vitest';

import { generateQuery } from '../src/query';

describe('generateQuery', () => {
  test('empty paths produces minimal queryClient', () => {
    const result = generateQuery({});
    expect(result).toContain("import type { apiClient } from './client'");
    expect(result).toContain('type ApiClient = ReturnType<typeof apiClient>');
    expect(result).toContain('export function queryClient(client: ApiClient)');
    expect(result).toContain('return {};');
  });

  test('exports queryClient function with ApiClient import', () => {
    const result = generateQuery({ '/users': { get: { responses: {} } } });
    expect(result).toContain("import type { apiClient } from './client'");
    expect(result).toContain('type ApiClient = ReturnType<typeof apiClient>');
    expect(result).toContain('export function queryClient(client: ApiClient)');
  });

  describe('tree structure mirrors apiClient', () => {
    test('static segment becomes an object property with key and path', () => {
      const result = generateQuery({ '/users': { get: { responses: {} } } });
      expect(result).toContain('users: {');
      expect(result).toContain('key: client.users.key,');
      expect(result).toContain('path: client.users.path,');
    });

    test('dynamic segment becomes a function like in apiClient', () => {
      const result = generateQuery({
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
      expect(result).toContain('key: client.users.id(id).key,');
      expect(result).toContain('path: client.users.id(id).path,');
    });

    test('segment with hyphens is quoted as property key', () => {
      const result = generateQuery({
        '/auth/verify-email': { post: { responses: {} } },
      });
      expect(result).toContain("'verify-email': {");
    });
  });

  describe('GET operations generate queryOptions', () => {
    test('GET without query params returns queryKey and queryFn', () => {
      const result = generateQuery({
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
      expect(result).toContain('get: (params?:');
      expect(result).toContain('queryKey: client.users.id(id).key,');
      expect(result).toContain(
        'queryFn: () => client.users.id(id).get(params),'
      );
    });

    test('GET with query params includes them in queryKey', () => {
      const result = generateQuery({
        '/users': {
          get: {
            parameters: [
              {
                in: 'query',
                name: 'page',
                schema: { type: 'integer' },
                required: false,
              },
              {
                in: 'query',
                name: 'limit',
                schema: { type: 'integer' },
                required: false,
              },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain(
        'queryKey: [...client.users.key, { page: params?.page, limit: params?.limit }] as const,'
      );
      expect(result).toContain('queryFn: () => client.users.get(params),');
    });

    test('GET with required query param makes params required', () => {
      const result = generateQuery({
        '/search': {
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
      expect(result).toContain('get: (params:');
      expect(result).not.toContain('get: (params?:');
    });
  });

  describe('mutation operations generate mutationOptions', () => {
    test('POST without body returns mutationFn with optional params', () => {
      const result = generateQuery({
        '/users': { post: { responses: {} } },
      });
      expect(result).toContain('* @method POST');
      expect(result).toContain('post: () => ({');
      expect(result).toContain('mutationFn: (params?:');
      expect(result).toContain('client.users.post(params),');
    });

    test('POST with body makes params required and includes body field', () => {
      const result = generateQuery({
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
      expect(result).toContain('post: () => ({');
      expect(result).toContain('mutationFn: (params:');
      expect(result).toContain('body:');
      expect(result).toContain('client.users.post(params),');
    });

    test('DELETE on dynamic path closes over path param', () => {
      const result = generateQuery({
        '/users/{id}': {
          delete: {
            parameters: [
              { in: 'path', name: 'id', schema: { type: 'string' } },
            ],
            responses: {},
          },
        },
      });
      expect(result).toContain('id: (id: string) => ({');
      expect(result).toContain('delete: () => ({');
      expect(result).toContain('client.users.id(id).delete(params),');
    });

    test('PUT and PATCH are treated as mutations', () => {
      const result = generateQuery({
        '/items/{id}': {
          put: { responses: {} },
          patch: { responses: {} },
        },
      });
      expect(result).toContain('put: () => ({');
      expect(result).toContain('mutationFn:');
      expect(result).toContain('patch: () => ({');
    });
  });

  describe('nested paths', () => {
    test('three-level path generates nested structure', () => {
      const result = generateQuery({
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
        'queryKey: client.orgs.orgId(orgId).members.memberId(memberId).key,'
      );
      expect(result).toContain(
        'queryFn: () => client.orgs.orgId(orgId).members.memberId(memberId).get(params),'
      );
    });
  });

  describe('snapshot', () => {
    test('full snapshot for GET /users/{id}', () => {
      const result = generateQuery({
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
      expect(result).toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    users: {
      	      id: (id: string) => ({
      	        key: client.users.id(id).key,
      	        path: client.users.id(id).path,
      	        /**
      	         * @method GET
      	         * @path /users/{id}
      	         */
      	        get: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }) => ({
      	          queryKey: client.users.id(id).key,
      	          queryFn: () => client.users.id(id).get(params),
      	        }),
      	      }),
      	    },
      	  };
      	}"
      `);
    });
  });
});
