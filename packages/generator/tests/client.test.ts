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
    expect(generateClient({})).toMatchInlineSnapshot(`
    	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
    	  return {};
    	}"
    `);
  });

  describe('static segments', () => {
    test('becomes an object property with key and path', () => {
      expect(generateClient({ '/users': { get: { responses: {} } } }))
        .toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      key: ['users'] as const,
      	      path: '/users' as const,
      	      /**
      	       * @method GET
      	       * @path /users
      	       */
      	      get: (params?: {
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }): Promise<void> => {
      	        const url = \`\${baseUrl}/users\`;
      	        return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	      },
      	    },
      	  };
      	}"
      `);
    });

    test('segment with hyphens is converted to camelCase', () => {
      expect(
        generateClient({ '/auth/verify-email': { post: { responses: {} } } })
      ).toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    auth: {
      	      verifyEmail: {
      	        key: ['auth', 'verify-email'] as const,
      	        path: '/auth/verify-email' as const,
      	        /**
      	         * @method POST
      	         * @path /auth/verify-email
      	         */
      	        post: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }): Promise<void> => {
      	          const url = \`\${baseUrl}/auth/verify-email\`;
      	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'POST' }).then(() => undefined);
      	        },
      	      },
      	    },
      	  };
      	}"
      `);
    });

    test('segment starting with underscore or dollar is not quoted', () => {
      expect(generateClient({ '/api/_public': { get: { responses: {} } } }))
        .toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    api: {
      	      _public: {
      	        key: ['api', '_public'] as const,
      	        path: '/api/_public' as const,
      	        /**
      	         * @method GET
      	         * @path /api/_public
      	         */
      	        get: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }): Promise<void> => {
      	          const url = \`\${baseUrl}/api/_public\`;
      	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	        },
      	      },
      	    },
      	  };
      	}"
      `);
    });
  });

  describe('dynamic segments', () => {
    test('becomes a function that returns an object with key and path', () => {
      expect(
        generateClient({
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
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      id: (id: string) => ({
      	        key: ['users', id] as const,
      	        path: \`/users/\${id}\`,
      	        /**
      	         * @method GET
      	         * @path /users/{id}
      	         */
      	        get: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }): Promise<void> => {
      	          const url = \`\${baseUrl}/users/\${id}\`;
      	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	        },
      	      }),
      	    },
      	  };
      	}"
      `);
    });

    test('uses schema type for param type', () => {
      expect(
        generateClient({
          '/items/{code}': {
            get: {
              parameters: [
                { in: 'path', name: 'code', schema: { type: 'integer' } },
              ],
              responses: {},
            },
          },
        })
      ).toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    items: {
      	      code: (code: number) => ({
      	        key: ['items', code] as const,
      	        path: \`/items/\${code}\`,
      	        /**
      	         * @method GET
      	         * @path /items/{code}
      	         */
      	        get: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }): Promise<void> => {
      	          const url = \`\${baseUrl}/items/\${code}\`;
      	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	        },
      	      }),
      	    },
      	  };
      	}"
      `);
    });

    test('defaults to string when no param schema', () => {
      expect(generateClient({ '/users/{id}': { get: { responses: {} } } }))
        .toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      id: (id: string) => ({
      	        key: ['users', id] as const,
      	        path: \`/users/\${id}\`,
      	        /**
      	         * @method GET
      	         * @path /users/{id}
      	         */
      	        get: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }): Promise<void> => {
      	          const url = \`\${baseUrl}/users/\${id}\`;
      	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	        },
      	      }),
      	    },
      	  };
      	}"
      `);
    });
  });

  describe('HTTP methods', () => {
    test('GET with response schema generates typed Promise return', () => {
      expect(
        generateClient({
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
      	"import type { User } from './types';

      	export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      id: (id: string) => ({
      	        key: ['users', id] as const,
      	        path: \`/users/\${id}\`,
      	        /**
      	         * @method GET
      	         * @path /users/{id}
      	         */
      	        get: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }): Promise<User> => {
      	          const url = \`\${baseUrl}/users/\${id}\`;
      	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then((r) => r.json()) as Promise<User>;
      	        },
      	      }),
      	    },
      	  };
      	}"
      `);
    });

    test('void return type when no success response', () => {
      expect(generateClient({ '/ping': { get: { responses: {} } } }))
        .toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    ping: {
      	      key: ['ping'] as const,
      	      path: '/ping' as const,
      	      /**
      	       * @method GET
      	       * @path /ping
      	       */
      	      get: (params?: {
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }): Promise<void> => {
      	        const url = \`\${baseUrl}/ping\`;
      	        return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	      },
      	    },
      	  };
      	}"
      `);
    });

    test('POST with request body generates params with body field', () => {
      expect(
        generateClient({
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
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      key: ['users'] as const,
      	      path: '/users' as const,
      	      /**
      	       * @method POST
      	       * @path /users
      	       */
      	      post: (params: {
      	          body: { name: string };
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }): Promise<void> => {
      	        const url = \`\${baseUrl}/users\`;
      	        return _fetch(url, { ..._baseInit, ...params?.init, headers: { 'Content-Type': 'application/json', ..._baseInit?.headers, ...params?.init?.headers }, method: 'POST', body: JSON.stringify(params.body) }).then(() => undefined);
      	      },
      	    },
      	  };
      	}"
      `);
    });
  });

  describe('query parameters', () => {
    test('optional query param generates URLSearchParams block and ? type', () => {
      expect(
        generateClient({
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
        })
      ).toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      key: ['users'] as const,
      	      path: '/users' as const,
      	      /**
      	       * @method GET
      	       * @path /users
      	       */
      	      get: (params?: {
      	          page?: number;
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }): Promise<void> => {
      	        const searchParams = new URLSearchParams();
      	        if (params?.page !== undefined) searchParams.set('page', String(params.page));
      	        const qs = searchParams.toString();
      	        const url = \`\${baseUrl}/users\` + (qs ? \`?\${qs}\` : '');
      	        return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	      },
      	    },
      	  };
      	}"
      `);
    });

    test('required query param makes params non-optional', () => {
      expect(
        generateClient({
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
        })
      ).toMatchInlineSnapshot(`
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      key: ['users'] as const,
      	      path: '/users' as const,
      	      /**
      	       * @method GET
      	       * @path /users
      	       */
      	      get: (params: {
      	          q: string;
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }): Promise<void> => {
      	        const searchParams = new URLSearchParams();
      	        if (params?.q !== undefined) searchParams.set('q', String(params.q));
      	        const qs = searchParams.toString();
      	        const url = \`\${baseUrl}/users\` + (qs ? \`?\${qs}\` : '');
      	        return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	      },
      	    },
      	  };
      	}"
      `);
    });
  });

  describe('node with both operations and children', () => {
    test('generates operation on parent and child accessor', () => {
      expect(
        generateClient({
          '/users': { get: { responses: {} } },
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
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    users: {
      	      key: ['users'] as const,
      	      path: '/users' as const,
      	      /**
      	       * @method GET
      	       * @path /users
      	       */
      	      get: (params?: {
      	          init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	        }): Promise<void> => {
      	        const url = \`\${baseUrl}/users\`;
      	        return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	      },
      	      id: (id: string) => ({
      	        key: ['users', id] as const,
      	        path: \`/users/\${id}\`,
      	        /**
      	         * @method GET
      	         * @path /users/{id}
      	         */
      	        get: (params?: {
      	            init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	          }): Promise<void> => {
      	          const url = \`\${baseUrl}/users/\${id}\`;
      	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	        },
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
        generateClient({
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
      	"export function apiClient(baseUrl: string, clientOptions?: { init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }; fetch?: typeof globalThis.fetch }) {
      	  const _fetch = clientOptions?.fetch ?? globalThis.fetch;
      	  const _baseInit = clientOptions?.init;
      	  return {
      	    orgs: {
      	      orgId: (orgId: string) => ({
      	        members: {
      	          memberId: (memberId: string) => ({
      	            key: ['orgs', orgId, 'members', memberId] as const,
      	            path: \`/orgs/\${orgId}/members/\${memberId}\`,
      	            /**
      	             * @method GET
      	             * @path /orgs/{orgId}/members/{memberId}
      	             */
      	            get: (params?: {
      	                init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
      	              }): Promise<void> => {
      	              const url = \`\${baseUrl}/orgs/\${orgId}/members/\${memberId}\`;
      	              return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(() => undefined);
      	            },
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
