import { describe, expect, test } from 'vite-plus/test';

import { generateFromObject } from '../src';

const spec = {
  openapi: '3.1.0',
  info: { version: '1.0.0', title: 'My API' },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123' },
          name: { type: 'string', example: 'John Doe' },
          age: { type: 'number', example: 42 },
        },
        required: ['id', 'name', 'age'],
      },
    },
    parameters: {},
  },
  paths: {
    '/users/{id}': {
      get: {
        parameters: [
          {
            schema: { type: 'string', minLength: 3, example: '1212121' },
            required: true,
            name: 'id',
            in: 'path',
          },
        ],
        responses: {
          '200': {
            description: 'Retrieve the user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
    },
  },
};

describe('generateFromObject', () => {
  test('generates types and client from a spec object', async () => {
    const result = await generateFromObject(spec);

    expect(result.types).toContain('export type User =');
    expect(result.client).toContain(
      'export function apiClient(baseUrl: string,'
    );
    expect(result.client).toContain('id: (id: string) => ({');
    expect(result.client).toContain("key: ['users', id] as const");
    expect(result.client).toContain('get: (params?: {');
    expect(result.client).toContain('): Promise<User> => {');
  });

  test('throws on unparseable OpenAPI spec', async () => {
    await expect(
      generateFromObject({ openapi: 'not-valid' })
    ).rejects.toThrow();
  });

  test('returns warnings instead of throwing for specs with minor issues', async () => {
    const result = await generateFromObject({
      openapi: '3.1.0',
      info: { title: 'x', version: '1' },
      paths: {},
      // extra unknown field that may trigger a warning
      'x-unknown-extension': true,
    });
    expect(result.types).toBe('');
    expect(result.client).toContain('apiClient');
  });

  test('throws on unsupported OpenAPI version', async () => {
    await expect(
      generateFromObject({
        openapi: '2.0',
        info: { title: 'x', version: '1' },
        paths: {},
      })
    ).rejects.toThrow('unsupported OpenAPI version');
  });

  test('accepts OpenAPI 3.0.x spec', async () => {
    const result = await generateFromObject({
      openapi: '3.0.3',
      info: { title: 'x', version: '1' },
      components: {
        schemas: {
          Item: {
            type: 'object',
            properties: { name: { type: 'string', nullable: true } },
            required: ['name'],
          },
        },
      },
      paths: {
        '/items': {
          get: {
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    });
    expect(result.types).toContain('name: string | null;');
    expect(result.client).toContain("key: ['items'] as const");
  });

  test('snapshot of full output', async () => {
    const result = await generateFromObject(spec);

    expect(result.types).toMatchInlineSnapshot(`
    	"/* eslint-disable */
    	/* prettier-ignore-start */
    	/**
    	 * User
    	 */
    	export type User = {
    	  /**
    	   * @example "123"
    	   */
    	  id: string;
    	  /**
    	   * @example "John Doe"
    	   */
    	  name: string;
    	  /**
    	   * @example 42
    	   */
    	  age: number;
    	};"
    `);

    expect(result.client).toMatchInlineSnapshot(`
    	"/* eslint-disable */
    	/* prettier-ignore-start */
    	import type { User } from './types';

    	export class HTTPError extends Error {
    	  readonly status: number;
    	  readonly statusText: string;
    	  readonly response: Response;
    	  constructor(response: Response) {
    	    super(\`HTTP Error: \${response.status} \${response.statusText}\`);
    	    this.name = 'HTTPError';
    	    this.status = response.status;
    	    this.statusText = response.statusText;
    	    this.response = response;
    	  }
    	}

    	function _checkOk(response: Response): Response {
    	  if (!response.ok) throw new HTTPError(response);
    	  return response;
    	}

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
    	          return _fetch(url, { ..._baseInit, ...params?.init, headers: { ..._baseInit?.headers, ...params?.init?.headers }, method: 'GET' }).then(_checkOk).then((r) => r.json()) as Promise<User>;
    	        },
    	      }),
    	    },
    	  };
    	}"
    `);
  });
});
