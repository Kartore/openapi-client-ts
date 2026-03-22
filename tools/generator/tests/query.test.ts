import { describe, expect, test } from 'vitest';

import { generateQuery } from '../src/query';

describe('generateQuery', () => {
  test('empty paths produces minimal queryClient', () => {
    expect(generateQuery({})).toMatchInlineSnapshot(`
    	"import type { apiClient } from './client';

    	type ApiClient = ReturnType<typeof apiClient>;

    	export function queryClient(client: ApiClient) {
    	  return {};
    	}"
    `);
  });

  describe('tree structure mirrors apiClient', () => {
    test('static segment with operation has key and path', () => {
      expect(generateQuery({ '/users': { get: { responses: {} } } }))
        .toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    users: {
      	      key: client.users.key,
      	      path: client.users.path,
      	      /**
      	       * @method GET
      	       * @path /users
      	       */
      	      get: (params?: {
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }) => ({
      	        queryKey: client.users.key,
      	        queryFn: () => client.users.get(params),
      	      }),
      	    },
      	  };
      	}"
      `);
    });

    test('intermediate node without operation has no key or path', () => {
      expect(
        generateQuery({
          '/users/{id}': {
            get: {
              parameters: [
                { in: 'path', name: 'id', schema: { type: 'string' } },
              ],
              responses: {},
            },
          },
        })
      ).toMatchInlineSnapshot(`
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

    test('segment with hyphens is quoted as property key', () => {
      expect(
        generateQuery({ '/auth/verify-email': { post: { responses: {} } } })
      ).toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    auth: {
      	      'verify-email': {
      	        key: client.auth['verify-email'].key,
      	        path: client.auth['verify-email'].path,
      	        /**
      	         * @method POST
      	         * @path /auth/verify-email
      	         */
      	        post: () => ({
      	          mutationFn: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }) => client.auth['verify-email'].post(params),
      	        }),
      	      },
      	    },
      	  };
      	}"
      `);
    });
  });

  describe('GET operations generate queryOptions', () => {
    test('GET without query params', () => {
      expect(
        generateQuery({
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
        })
      ).toMatchInlineSnapshot(`
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

    test('GET with query params includes them in queryKey', () => {
      expect(
        generateQuery({
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
        })
      ).toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    users: {
      	      key: client.users.key,
      	      path: client.users.path,
      	      /**
      	       * @method GET
      	       * @path /users
      	       */
      	      get: (params?: {
      	          page?: number;
      	          limit?: number;
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }) => ({
      	        queryKey: [...client.users.key, { page: params?.page, limit: params?.limit }] as const,
      	        queryFn: () => client.users.get(params),
      	      }),
      	    },
      	  };
      	}"
      `);
    });

    test('GET with required query param makes params non-optional', () => {
      expect(
        generateQuery({
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
        })
      ).toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    search: {
      	      key: client.search.key,
      	      path: client.search.path,
      	      /**
      	       * @method GET
      	       * @path /search
      	       */
      	      get: (params: {
      	          q: string;
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }) => ({
      	        queryKey: [...client.search.key, { q: params?.q }] as const,
      	        queryFn: () => client.search.get(params),
      	      }),
      	    },
      	  };
      	}"
      `);
    });
  });

  describe('mutation operations generate mutationOptions', () => {
    test('POST without body', () => {
      expect(generateQuery({ '/users': { post: { responses: {} } } }))
        .toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    users: {
      	      key: client.users.key,
      	      path: client.users.path,
      	      /**
      	       * @method POST
      	       * @path /users
      	       */
      	      post: () => ({
      	        mutationFn: (params?: {
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }) => client.users.post(params),
      	      }),
      	    },
      	  };
      	}"
      `);
    });

    test('POST with request body makes params required', () => {
      expect(
        generateQuery({
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
        })
      ).toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    users: {
      	      key: client.users.key,
      	      path: client.users.path,
      	      /**
      	       * @method POST
      	       * @path /users
      	       */
      	      post: () => ({
      	        mutationFn: (params: {
      	          body: { name: string };
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }) => client.users.post(params),
      	      }),
      	    },
      	  };
      	}"
      `);
    });

    test('DELETE closes over path param in outer function', () => {
      expect(
        generateQuery({
          '/users/{id}': {
            delete: {
              parameters: [
                { in: 'path', name: 'id', schema: { type: 'string' } },
              ],
              responses: {},
            },
          },
        })
      ).toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    users: {
      	      id: (id: string) => ({
      	        key: client.users.id(id).key,
      	        path: client.users.id(id).path,
      	        /**
      	         * @method DELETE
      	         * @path /users/{id}
      	         */
      	        delete: () => ({
      	          mutationFn: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }) => client.users.id(id).delete(params),
      	        }),
      	      }),
      	    },
      	  };
      	}"
      `);
    });
  });

  describe('deep nesting', () => {
    test('three-level path with two dynamic segments', () => {
      expect(
        generateQuery({
          '/orgs/{orgId}/members/{memberId}': {
            get: {
              parameters: [
                { in: 'path', name: 'orgId', schema: { type: 'string' } },
                { in: 'path', name: 'memberId', schema: { type: 'string' } },
              ],
              responses: {},
            },
          },
        })
      ).toMatchInlineSnapshot(`
      	"import type { apiClient } from './client';

      	type ApiClient = ReturnType<typeof apiClient>;

      	export function queryClient(client: ApiClient) {
      	  return {
      	    orgs: {
      	      orgId: (orgId: string) => ({
      	        members: {
      	          memberId: (memberId: string) => ({
      	            key: client.orgs.orgId(orgId).members.memberId(memberId).key,
      	            path: client.orgs.orgId(orgId).members.memberId(memberId).path,
      	            /**
      	             * @method GET
      	             * @path /orgs/{orgId}/members/{memberId}
      	             */
      	            get: (params?: {
      	                init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	              }) => ({
      	              queryKey: client.orgs.orgId(orgId).members.memberId(memberId).key,
      	              queryFn: () => client.orgs.orgId(orgId).members.memberId(memberId).get(params),
      	            }),
      	          }),
      	        },
      	      }),
      	    },
      	  };
      	}"
      `);
    });
  });
});
